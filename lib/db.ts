interface DBChat {
  id: string
  title: string
  messages: DBMessage[]
  createdAt: string
  updatedAt: string
}

interface DBMessage {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: string
  isStreaming?: boolean
}

interface DBSettings {
  apiKey: string
  favoriteModels: string[]
  selectedModel?: string
}

class ChatDatabase {
  private dbName = "ai-chat-db"
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create chats store
        if (!db.objectStoreNames.contains("chats")) {
          const chatsStore = db.createObjectStore("chats", { keyPath: "id" })
          chatsStore.createIndex("updatedAt", "updatedAt", { unique: false })
        }

        // Create settings store
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" })
        }
      }
    })
  }

  async saveChats(chats: any[]): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["chats"], "readwrite")
      const store = transaction.objectStore("chats")

      // Clear existing chats
      const clearRequest = store.clear()
      clearRequest.onsuccess = () => {
        // Add all chats
        const promises = chats.map((chat) => {
          const dbChat: DBChat = {
            ...chat,
            createdAt: chat.createdAt.toISOString(),
            updatedAt: chat.updatedAt.toISOString(),
            messages: chat.messages.map((msg: any) => ({
              ...msg,
              timestamp: msg.timestamp.toISOString(),
            })),
          }
          return new Promise<void>((resolve, reject) => {
            const addRequest = store.add(dbChat)
            addRequest.onsuccess = () => resolve()
            addRequest.onerror = () => reject(addRequest.error)
          })
        })

        Promise.all(promises)
          .then(() => resolve())
          .catch(reject)
      }
      clearRequest.onerror = () => reject(clearRequest.error)
    })
  }

  async loadChats(): Promise<any[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["chats"], "readonly")
      const store = transaction.objectStore("chats")
      const request = store.getAll()

      request.onsuccess = () => {
        const dbChats = request.result as DBChat[]
        const chats = dbChats.map((chat) => ({
          ...chat,
          createdAt: new Date(chat.createdAt),
          updatedAt: new Date(chat.updatedAt),
          messages: chat.messages.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }))
        resolve(chats)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async saveSettings(settings: DBSettings): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["settings"], "readwrite")
      const store = transaction.objectStore("settings")
      const request = store.put({ key: "main", ...settings })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async loadSettings(): Promise<DBSettings | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["settings"], "readonly")
      const store = transaction.objectStore("settings")
      const request = store.get("main")

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          const { key, ...settings } = result
          resolve(settings as DBSettings)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  async migrateFromLocalStorage(): Promise<void> {
    try {
      // Migrate settings
      const savedSettings = localStorage.getItem("ai-chat-settings")
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        await this.saveSettings(settings)
        localStorage.removeItem("ai-chat-settings")
      }

      // Migrate chats
      const savedChats = localStorage.getItem("ai-chat-history")
      if (savedChats) {
        const chats = JSON.parse(savedChats)
        const chatsWithDates = chats.map((chat: any) => ({
          ...chat,
          createdAt: new Date(chat.createdAt),
          updatedAt: new Date(chat.updatedAt),
          messages: chat.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }))
        await this.saveChats(chatsWithDates)
        localStorage.removeItem("ai-chat-history")
      }
    } catch (error) {
      console.error("Migration from localStorage failed:", error)
    }
  }
}

// Create singleton instance
export const chatDB = new ChatDatabase()

// Fallback functions for localStorage compatibility
export const storage = {
  async init(): Promise<void> {
    try {
      await chatDB.init()
    } catch (error) {
      console.error("IndexedDB initialization failed:", error)
    }
  },

  async migrateFromLocalStorage(): Promise<void> {
    try {
      await chatDB.migrateFromLocalStorage()
    } catch (error) {
      console.error("Migration from localStorage failed:", error)
    }
  },

  async saveChats(chats: any[]): Promise<void> {
    try {
      await chatDB.saveChats(chats)
    } catch (error) {
      console.error("IndexedDB save failed, falling back to localStorage:", error)
      localStorage.setItem("ai-chat-history", JSON.stringify(chats))
    }
  },

  async loadChats(): Promise<any[]> {
    try {
      return await chatDB.loadChats()
    } catch (error) {
      console.error("IndexedDB load failed, falling back to localStorage:", error)
      const savedChats = localStorage.getItem("ai-chat-history")
      if (savedChats) {
        const parsed = JSON.parse(savedChats)
        return parsed.map((chat: any) => ({
          ...chat,
          createdAt: new Date(chat.createdAt),
          updatedAt: new Date(chat.updatedAt),
          messages: chat.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }))
      }
      return []
    }
  },

  async saveSettings(settings: DBSettings): Promise<void> {
    try {
      await chatDB.saveSettings(settings)
    } catch (error) {
      console.error("IndexedDB save failed, falling back to localStorage:", error)
      localStorage.setItem("ai-chat-settings", JSON.stringify(settings))
    }
  },

  async loadSettings(): Promise<DBSettings | null> {
    try {
      return await chatDB.loadSettings()
    } catch (error) {
      console.error("IndexedDB load failed, falling back to localStorage:", error)
      const savedSettings = localStorage.getItem("ai-chat-settings")
      return savedSettings ? JSON.parse(savedSettings) : null
    }
  },
}

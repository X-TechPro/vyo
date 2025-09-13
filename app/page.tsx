"use client"

import * as React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import {
  Settings,
  Menu,
  Send,
  Globe,
  Brain,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Star,
  Search,
  Plus,
  Trash2,
  Square,
} from "lucide-react"
import { Copy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { storage } from "@/lib/db"
import { motion } from "framer-motion"
import hljs from "highlight.js"
import katex from "katex"
/* Removed duplicate React import */

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  isStreaming?: boolean
  reasoningContent?: string
  modelId?: string
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

interface OpenRouterModel {
  id: string
  name: string
  description?: string
  context_length?: number
  pricing?: {
    prompt: string
    completion: string
  }
}
const glmFlashModel: OpenRouterModel = {
  id: "glm-4.5-flash",
  name: "GLM 4.5 Flash",
};

interface SettingsData {
  apiKey: string
  favoriteModels: string[]
  selectedModel?: string // Added selectedModel to persist model selection
}

const messageVariants: any = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

const typingVariants: any = {
  animate: {
    scale: [1, 1.2, 1],
    transition: {
      duration: 0.6,
      repeat: Number.POSITIVE_INFINITY,
  ease: "easeInOut",
    },
  },
}

const CodeBlock = ({ children, className, isStreaming, ...props }: any) => {
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLElement>(null)

  const code = children?.toString() || ""
  const language = className?.replace("language-", "") || "text"

  useEffect(() => {
    if (codeRef.current && code.trim().startsWith("```")) {
      return
    }

    // Skip highlighting while streaming; highlight only when content is final
    if (codeRef.current && language !== "text" && !isStreaming) {
      hljs.highlightElement(codeRef.current)
    }
  }, [code, language, isStreaming])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy code:", err)
    }
  }

  if (!code.includes("\n") && !className) {
    return <code className="bg-secondary/50 px-1 py-0.5 rounded text-sm font-mono">{children}</code>
  }

  return (
    <div className="code-block">
      <div className="code-header">
        <span>{language}</span>
        <button className="copy-button" onClick={copyToClipboard}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto">
        <code ref={codeRef} className={`hljs language-${language}`} {...props}>
          {children}
        </code>
      </pre>
    </div>
  )
}

const MarkdownCode = ({ children, className, isStreaming, ...props }: any) => {
  const code = children?.toString() || ""
  const language = className?.replace("language-", "") || "text"

  // Render fenced math blocks (```math / ```latex / ```tex / ```katex) with KaTeX
  if (["math", "latex", "tex", "katex"].includes(language)) {
    try {
      const html = katex.renderToString(code, {
        displayMode: true,
        throwOnError: false,
        strict: false,
      })
      return <div className="katex-display" dangerouslySetInnerHTML={{ __html: html }} />
    } catch {
      // Fallback to raw code if KaTeX fails
      return (
        <pre className="overflow-x-auto">
          <code>{code}</code>
        </pre>
      )
    }
  }

  // Otherwise, regular code highlighting
  return (
    <CodeBlock className={className} isStreaming={isStreaming} {...props}>
      {children}
    </CodeBlock>
  )
}

const MarkdownComponents = {
  code: CodeBlock,
  h1: ({ children }: any) => <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-semibold mb-3 mt-5">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-medium mb-2 mt-4">{children}</h3>,
  h4: ({ children }: any) => <h4 className="text-base font-medium mb-2 mt-3">{children}</h4>,
  // Keep headings flush-left. Add left padding/indent for non-heading content so lists and
  // paragraphs align in a cascade under headings.
  // Lists and paragraphs inherit a larger base font so bullets and body text match
  ul: ({ children }: any) => (
    <ul className="list-disc list-outside mb-4 space-y-1 pl-6 text-base md:text-lg">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-outside mb-4 space-y-1 pl-6 text-base md:text-lg">{children}</ol>
  ),
  li: ({ children }: any) => <li className="pl-1 text-base md:text-lg">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-4 ml-2">{children}</blockquote>
  ),
  // Paragraphs should be indented slightly from the left to create visual cascade under headings
  p: ({ children }: any) => <p className="mb-3 last:mb-0 pl-4 text-base md:text-lg">{children}</p>,
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-4 border border-border rounded-lg">
      <table className="min-w-full divide-y divide-border">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-muted/50">{children}</thead>,
  tbody: ({ children }: any) => <tbody className="bg-card divide-y divide-border">{children}</tbody>,
  tr: ({ children }: any) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
  th: ({ children }: any) => (
    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }: any) => <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">{children}</td>,
}

// Smart normalizer: convert bracketed math like "[ ... ]" to display math "$$ ... $$"
// but only when the inner content looks like LaTeX (contains backslash commands, '^', '_', LaTeX keywords, or braces).
function normalizeMathDelimiters(text: string) {
  if (!text) return text

  // Regex to find standalone bracket groups not followed by '(' (to avoid markdown links)
  // This will match the shortest content between square brackets.
  const bracketRegex = /\[\s*([^\]\n]+?)\s*\](?!\()/g
  let normalized = text
    // Strip zero-width / BOM chars and non-breaking spaces that break KaTeX parsing
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")

  // 1) Unescape common double-escaped delimiters produced by some generators or APIs
  //    e.g. "\\( E = mc^2 \\)" -> "\( E = mc^2 \)" and "\\$\\$...\\$\\$" -> "$$...$$"
  normalized = normalized.replace(/\\\\\$\\\\\$/g, "$$") // \\$\\$ -> $$ (very escaped)
  normalized = normalized.replace(/\\\\\$/g, "$") // \\$ -> $
  normalized = normalized.replace(/\\\\\(/g, "\\(") // \\(... -> \(...
  normalized = normalized.replace(/\\\\\)/g, "\\)")
  normalized = normalized.replace(/\\\\\[/g, "\\[")
  normalized = normalized.replace(/\\\\\]/g, "\\]")

  // 2) Also replace single-escaped dollar-pairs like "\$\$...\$\$" -> "$$...$$"
  // Use function replacer to avoid special replacement-string sequences
  normalized = normalized.replace(/\$\$([\s\S]+?)\$\$/g, (_, group1) => `$$${group1}$$`)

  // 3) Convert \[ ... \] to $$ ... $$ so display math is uniform
  normalized = normalized.replace(/\\\[\s*([\s\S]+?)\s*\\\]/g, (_, group1) => `$$${group1}$$`)

  // 4) Normalize inline math \( ... \)
  // - If it starts with \displaystyle or contains a LaTeX environment (e.g. \begin{...})
  //   force display math so environments like bmatrix/align/split render correctly.
  // - Otherwise convert \( ... \) to inline $...$ so remark-math reliably parses it.
  normalized = normalized.replace(/\\\(\s*([\s\S]+?)\s*\\\)/g, (_, group1) => {
    const trimmed = (group1 || "").trim()
    if (/^\\displaystyle\b/.test(trimmed) || /\\begin\{[a-zA-Z*]+\}/.test(trimmed)) {
      const cleaned = trimmed.replace(/^\\displaystyle\b\s*/, "")
      return `$$${cleaned}$$`
    }
    return `$${trimmed}$`
  })

  // 5) Handle LaTeX environments: equation, equation*, align/align*, alignat, gather/gather*, split, cases.
  // IMPORTANT: Do not inject $$ here to avoid double-wrapping when the source already uses \[...\] or $$...$$.
  // We only normalize environment names so KaTeX-friendly forms are produced; outer display/inline wrapping is handled elsewhere.
  normalized = normalized.replace(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g, (_, body) => `${body}`)
  normalized = normalized.replace(/\\begin\{equation\*\}([\s\S]*?)\\end\{equation\*\}/g, (_, body) => `${body}`)
 
  // align/align* -> aligned for column alignment (keep inside the existing display wrapper)
  normalized = normalized.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (_, body) => `\\begin{aligned}${body}\\end{aligned}`)
 
  // alignat with column count (supported by KaTeX)
  normalized = normalized.replace(/\\begin\{alignat\}\{([^\}]+)\}([\s\S]*?)\\end\{alignat\}/g, (_, cols, body) => `\\begin{alignat}{${cols}}${body}\\end{alignat}`)
 
  // gather / gather*
  normalized = normalized.replace(/\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g, (_, body) => `\\begin{gather}${body}\\end{gather}`)
 
  // split (kept as-is, assuming it sits inside a display wrapper)
  normalized = normalized.replace(/\\begin\{split\}([\s\S]*?)\\end\{split\}/g, (_, body) => `\\begin{split}${body}\\end{split}`)
 
  // cases
  normalized = normalized.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_, body) => `\\begin{cases}${body}\\end{cases}`)
// Convert \\boxed{ \\begin{array}{...} ... } to \\boxed{\\begin{aligned} ... \\end{aligned}}
// This avoids KaTeX issues with array rows like {} and improves rendering in summary blocks.
normalized = normalized.replace(/\\boxed\\{\\s*\\begin\\{array\\}\\{[^}]+\\}([\\s\\S]*?)\\end\\{array\\}\\s*\\}/g, (_match, body) => {
  const cleaned = String(body)
    .split(/\\n/)
    .map((l) => l.trim())
    .filter((l) => l && l !== '{}' && l !== '\\\\' && l !== '{} \\\\' && l !== '{}\\\\')
    .join('\\n')
  return `\\boxed{\\begin{aligned}${cleaned}\\end{aligned}}`
})
 
  return normalized.replace(bracketRegex, (match, inner) => {
    // Heuristics to decide if inner looks like LaTeX math:
    const mathIndicators = /\\[A-Za-z]+|\\\{|\\\}|\\\(|\\\)|\\\]|\\\[|\^|_|\{\}|\{|\}|\\frac|\\begin|\\end|\\sum|\\int|\\alpha|\\beta|\\gamma|\\boxed|\\sqrt/.test(inner)

    // Also allow if it contains common math-only characters like =, ±, ×, ÷, <, > and digits with subscripts/superscripts
    const extraIndicators = /[=<>±×÷]|\^|_/.test(inner)

    if (mathIndicators || extraIndicators) {
      // Wrap as display math. Keep inner as-is to preserve LaTeX escapes.
      return `$$${inner}$$`
    }

    // Otherwise leave original match unchanged
    return match
  })
}

export default function ChatInterface() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const [inputValue, setInputValue] = useState("")
  const [webSearch, setWebSearch] = useState(false)
  const [think, setThink] = useState(false)
  const [selectedModel, setSelectedModel] = useState<OpenRouterModel | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [models, setModels] = useState<OpenRouterModel[]>([])
  const [filteredModels, setFilteredModels] = useState<OpenRouterModel[]>([])
  const [modelSearch, setModelSearch] = useState("")
  const [loadingModels, setLoadingModels] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [settings, setSettings] = useState<SettingsData>({
    apiKey: "",
    favoriteModels: [],
  })
  const [tempSettings, setTempSettings] = useState<SettingsData>({
    apiKey: "",
    favoriteModels: [],
  })
  // GLM 4.5 Flash reasoning stream state
  const [reasoningExpandedMap, setReasoningExpandedMap] = useState<Record<string, boolean>>({})
  const toggleReasoningExpanded = (id: string) => {
    setReasoningExpandedMap((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }))
  }

  const { toast } = useToast()
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const currentChat = chats.find((chat) => chat.id === currentChatId)
  const messages = currentChat?.messages || []

  const favoriteModels = models.filter((model) => (settings.favoriteModels || []).includes(model.id))

  const scrollToBottom = () => {
    const container = messagesContainerRef.current
    if (container) {
      try {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
        return
      } catch (e) {
        // some browsers may not support smooth option; fallback to instant
        container.scrollTop = container.scrollHeight
        return
      }
    }

    // Fallback: scroll element (may scroll the document)
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const initializeData = async () => {
      try {
        await storage.init()
        await storage.migrateFromLocalStorage()

        const savedSettings = await storage.loadSettings()
        if (savedSettings) {
          setSettings(savedSettings)
          setTempSettings(savedSettings)
          // Ensure GLM 4.5 Flash is always in favorite models
          if (!savedSettings.favoriteModels?.includes(glmFlashModel.id)) {
            setTempSettings(prev => ({
              ...prev,
              favoriteModels: [...(prev.favoriteModels || []), glmFlashModel.id],
            }));
            setSettings(prev => ({
              ...prev,
              favoriteModels: [...(prev.favoriteModels || []), glmFlashModel.id],
            }));
          }

          if (savedSettings.selectedModel) {
            // We'll set the model after models are loaded
            setTimeout(() => {
              const model = models.find((m) => m.id === savedSettings.selectedModel)
              if (model) {
                setSelectedModel(model)
              }
            }, 1000)
          }
        }

        const savedChats = await storage.loadChats()
        if (savedChats.length > 0) {
          setChats(savedChats)
          const mostRecent = savedChats.sort((a: Chat, b: Chat) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
          setCurrentChatId(mostRecent.id)
        }
      } catch (error) {
        console.error("Failed to initialize data:", error)
        toast({
          title: "Storage Error",
          description: "Failed to load saved data. Some features may not work properly.",
          variant: "destructive",
        })
      }
    }

    initializeData()
  }, [])

  useEffect(() => {
    if (settings.apiKey && models.length === 0) {
      fetchModels().then(() => {
        if (settings.selectedModel) {
          const model = models.find((m) => m.id === settings.selectedModel)
          if (model) {
            setSelectedModel(model)
          }
        }
      })
    }
  }, [settings.apiKey])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (chats.length > 0) {
        saveChatsToStorage(chats)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [messages])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setSidebarOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [sidebarOpen])

  const saveChatsToStorage = async (updatedChats: Chat[]) => {
    try {
      await storage.saveChats(updatedChats)
    } catch (error) {
      console.error("Failed to save chats:", error)
      toast({
        title: "Storage Error",
        description: "Failed to save chat history",
        variant: "destructive",
      })
    }
  }

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const updatedChats = [newChat, ...chats]
    setChats(updatedChats)
    setCurrentChatId(newChat.id)
    saveChatsToStorage(updatedChats)
  }

  const switchToChat = (chatId: string) => {
    setCurrentChatId(chatId)
    setSidebarOpen(false)
  }

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updatedChats = chats.filter((chat) => chat.id !== chatId)
    setChats(updatedChats)

    if (currentChatId === chatId) {
      setCurrentChatId(updatedChats.length > 0 ? updatedChats[0].id : null)
    }

    await saveChatsToStorage(updatedChats)
  }

  const addMessage = (chatId: string, message: Message) => {
    setChats((prevChats) => {
      const updatedChats = prevChats.map((chat) => {
        if (chat.id === chatId) {
          const updatedChat = {
            ...chat,
            messages: [...chat.messages, message],
            updatedAt: new Date(),
          }

          if (message.role === "user" && chat.messages.length === 0) {
            updatedChat.title = message.content.length > 30 ? message.content.substring(0, 30) + "..." : message.content
          }

          return updatedChat
        }
        return chat
      })

      setTimeout(() => saveChatsToStorage(updatedChats), 100)
      return updatedChats
    })
  }

  const updateStreamingMessage = (chatId: string, messageId: string, content: string) => {
    setChats((prevChats) => {
      const updatedChats = prevChats.map((chat) => {
        if (chat.id === chatId) {
          const updatedMessages = chat.messages.map((msg) => {
            if (msg.id === messageId) {
              return { ...msg, content }
            }
            return msg
          })
          return { ...chat, messages: updatedMessages, updatedAt: new Date() }
        }
        return chat
      })
      return updatedChats
    })

    // Highlight code blocks after updating the DOM. Use the imported hljs directly
    // Highlighting handled by CodeBlock component; removed redundant DOM highlight
  }

  const updateStreamingReasoning = (chatId: string, messageId: string, delta: string) => {
    setChats((prevChats) => {
      const updatedChats = prevChats.map((chat) => {
        if (chat.id !== chatId) return chat
        const updatedMessages = chat.messages.map((msg) => {
          if (msg.id !== messageId) return msg
          const prev = msg.reasoningContent || ""
          return { ...msg, reasoningContent: prev + delta }
        })
        return { ...chat, messages: updatedMessages, updatedAt: new Date() }
      })
      return updatedChats
    })
  }

  const completeStreamingMessage = (chatId: string, messageId: string) => {
    setChats((prevChats) => {
      const updatedChats = prevChats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((msg) => (msg.id === messageId ? { ...msg, isStreaming: false } : msg)),
              updatedAt: new Date(),
            }
          : chat,
      )

      setTimeout(() => saveChatsToStorage(updatedChats), 100)
      return updatedChats
    })

    // Final highlight pass after streaming completes
    // Final highlight now handled by CodeBlock component; removed redundant DOM highlight
  }

  const fetchModels = async () => {
    if (!settings.apiKey && !tempSettings.apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenRouter API key first",
        variant: "destructive",
      })
      return
    }

    setLoadingModels(true)
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${settings.apiKey || tempSettings.apiKey}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const sortedModels = data.data.sort((a: OpenRouterModel, b: OpenRouterModel) => a.name.localeCompare(b.name))
      // Append GLM 4.5 Flash model to the list
      const allModels = [...sortedModels, glmFlashModel];
      setModels(allModels)
      setFilteredModels(allModels)

      if (settings.selectedModel) {
        const model = allModels.find((m: OpenRouterModel) => m.id === settings.selectedModel)
        if (model) {
          setSelectedModel(model)
        }
      } else {
        // No model selected yet; default to GLM 4.5 Flash
        setSelectedModel(glmFlashModel);
      }

      toast({
        title: "Models Loaded",
        description: `Loaded ${sortedModels.length} models successfully`,
      })
    } catch (error) {
      console.error("Error fetching models:", error)
      toast({
        title: "Error",
        description: "Failed to fetch models. Please check your API key.",
        variant: "destructive",
      })
    } finally {
      setLoadingModels(false)
    }
  }

  const sendMessageToAPI = async (chatId: string, content: string, userMessage: Message) => {
    if (!selectedModel) return

    setIsGenerating(true)
    abortControllerRef.current = new AbortController()
 const aiMessage: Message = {
   id: Date.now().toString() + "-ai",
   content: "",
   role: "assistant",
   timestamp: new Date(),
   isStreaming: true,
   reasoningContent: selectedModel.id === "glm-4.5-flash" ? "" : undefined,
   modelId: selectedModel.id,
 }


    addMessage(chatId, aiMessage)

    try {
      const currentChatMessages = chats.find((chat) => chat.id === chatId)?.messages || []
      const conversationHistory = [...currentChatMessages.filter((msg) => !msg.isStreaming), userMessage].map(
        (msg) => ({
          role: msg.role,
          content: msg.content,
        }),
      )

      console.log("[v0] Sending conversation history:", conversationHistory)
      console.log("[v0] Selected model:", selectedModel.id)
      console.log("[v0] API Key present:", !!settings.apiKey)

      const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer f52a1d00b1104a07b5dbe3af1548c2ae.A5ZkpXooEMbkU8Kd",
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "AI Chat Interface",
        },
        body: JSON.stringify({
          model: selectedModel.id,
          messages: conversationHistory,
          stream: true,
          temperature: 0.7,
        }),
        signal: abortControllerRef.current.signal,
      })

      console.log("[v0] API Response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.log("[v0] API Error response:", errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              const data = line.slice(6)
              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta || {}
                const content = delta.content
                const reasoning = delta.reasoning_content
                if (typeof reasoning === "string" && reasoning.length > 0 && selectedModel.id === "glm-4.5-flash") {
                  updateStreamingReasoning(chatId, aiMessage.id, reasoning)
                }
                if (typeof content === "string" && content.length > 0) {
                  accumulatedContent += content
                  updateStreamingMessage(chatId, aiMessage.id, accumulatedContent)
                  // Highlighting deferred to CodeBlock component after streaming completes
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      completeStreamingMessage(chatId, aiMessage.id)
    } catch (error: any) {
      if (error.name === "AbortError") {
        completeStreamingMessage(chatId, aiMessage.id)
      } else {
        console.error("Error sending message:", error)
        updateStreamingMessage(chatId, aiMessage.id, "Sorry, there was an error processing your request.")
        completeStreamingMessage(chatId, aiMessage.id)
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsGenerating(false)
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied",
        description: "Message copied to clipboard",
      })
    } catch (e) {
      console.error("Clipboard error", e)
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const handleCopyMessage = (message: Message) => {
    copyText(message.content)
  }

  const handleDeleteUserAndReply = (userMessageId: string) => {
    if (!currentChatId) return
    setChats((prevChats) => {
      const updatedChats = prevChats.map((chat) => {
        if (chat.id !== currentChatId) return chat
        const idx = chat.messages.findIndex((m) => m.id === userMessageId && m.role === "user")
        if (idx === -1) return chat
        const newMessages = [...chat.messages]

        // Remove the user message
        newMessages.splice(idx, 1)

        // If the next message is the assistant's response, remove it too
        if (newMessages[idx]?.role === "assistant") {
          const aiMsg = newMessages[idx]
          if (aiMsg?.isStreaming && abortControllerRef.current) {
            try {
              abortControllerRef.current.abort()
            } catch {}
          }
          newMessages.splice(idx, 1)
        }

        return { ...chat, messages: newMessages, updatedAt: new Date() }
      })

      // Persist after a short delay (consistent with other updates)
      setTimeout(() => saveChatsToStorage(updatedChats), 100)
      return updatedChats
    })

    toast({
      title: "Deleted",
      description: "Message removed",
    })
  }

  const toggleFavoriteModel = (modelId: string) => {
    const updatedFavorites = tempSettings.favoriteModels.includes(modelId)
      ? tempSettings.favoriteModels.filter((id) => id !== modelId)
      : [...tempSettings.favoriteModels, modelId]

    setTempSettings({
      ...tempSettings,
      favoriteModels: updatedFavorites,
    })
  }

  const saveSettings = async () => {
    if (!tempSettings.apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid API key",
        variant: "destructive",
      })
      return
    }

    if (!tempSettings.apiKey.startsWith("sk-or-")) {
      toast({
        title: "Warning",
        description: "API key should start with 'sk-or-' for OpenRouter",
        variant: "destructive",
      })
      return
    }

    const settingsToSave = {
      ...tempSettings,
      selectedModel: selectedModel?.id,
    }

    setSettings(settingsToSave)

    try {
      await storage.saveSettings(settingsToSave)
      setSettingsOpen(false)

      toast({
        title: "Settings Saved",
        description: "Your API key and preferences have been saved successfully",
      })

      if (tempSettings.apiKey !== settings.apiKey) {
        setTimeout(fetchModels, 500)
      }
    } catch (error) {
      console.error("Failed to save settings:", error)
      toast({
        title: "Storage Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    }
  }

  const handleModelSelectorOpen = (open: boolean) => {
    setModelSelectorOpen(open)
  }

  const selectModel = async (model: OpenRouterModel) => {
    setSelectedModel(model)
    setModelSelectorOpen(false)

    const updatedSettings = {
      ...settings,
      selectedModel: model.id,
    }
    setSettings(updatedSettings)
    await storage.saveSettings(updatedSettings)

    toast({
      title: "Model Selected",
      description: `Now using ${model.name}`,
    })
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isGenerating) return

    if (!settings.apiKey) {
      toast({
        title: "API Key Required",
        description: "Please set your OpenRouter API key in settings first",
        variant: "destructive",
      })
      setSettingsOpen(true)
      return
    }

    if (!selectedModel) {
      toast({
        title: "Model Required",
        description: "Please select a model first",
        variant: "destructive",
      })
      setModelSelectorOpen(true)
      return
    }

    const messageContent = inputValue.trim()
    setInputValue("")

    let chatId = currentChatId
    if (!chatId) {
      const newChat: Chat = {
        id: Date.now().toString(),
        title: messageContent.length > 30 ? messageContent.substring(0, 30) + "..." : messageContent,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const updatedChats = [newChat, ...chats]
      setChats(updatedChats)
      setCurrentChatId(newChat.id)
      chatId = newChat.id
      await saveChatsToStorage(updatedChats)
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      role: "user",
      timestamp: new Date(),
    }

    addMessage(chatId, userMessage)
    await sendMessageToAPI(chatId, messageContent, userMessage)
  }

  const highlightCodeBlocks = () => {
    setTimeout(() => {
      document.querySelectorAll("pre code").forEach((block) => {
        try {
          hljs.highlightElement(block as HTMLElement)
        } catch (e) {
          // ignore
        }
      })
    }, 50) // Reduced timeout for more responsive highlighting
  }

  return (
  <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <motion.div
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-card/95 border-r border-border transform transition-all duration-500 ease-out ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
        initial={sidebarOpen ? "visible" : "hidden"}
        animate={sidebarOpen ? "visible" : "hidden"}
        variants={{
          hidden: { opacity: 0, x: "-100%" },
          visible: { opacity: 1, x: "0%" },
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="relative h-full flex flex-col">
          <div className="p-4 border-b border-border/50">
            <Button
              onClick={createNewChat}
              className="w-full rounded-full bg-primary hover:bg-primary/90 transition-all duration-300"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {chats.map((chat, index) => (
              <motion.div
                key={chat.id}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-300 ${
                  currentChatId === chat.id
                    ? "bg-primary/20 border border-primary/30 shadow-lg"
                    : "hover:bg-secondary/50 hover:shadow-md"
                }`}
                onClick={() => switchToChat(chat.id)}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: "fadeInUp 0.5s ease-out forwards",
                }}
                initial="hidden"
                animate="visible"
                variants={messageVariants}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{chat.title}</p>
                  <p className="text-xs text-muted-foreground">{chat.messages.length} messages</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
  <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/30 backdrop-blur-sm">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-full p-2 hover:bg-secondary/80 transition-all duration-200"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Popover open={modelSelectorOpen} onOpenChange={handleModelSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="rounded-full px-4 py-2 bg-secondary/50 border-border hover:bg-secondary/70 transition-all duration-200 max-w-48"
                >
                  <span className="truncate">{selectedModel ? selectedModel.name : "Select Model"}</span>
                  <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 bg-card border-border" align="start">
                <div className="p-4">
                  <h3 className="font-medium mb-3">Favorite Models</h3>
                  {favoriteModels.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No favorite models yet</p>
                      <p className="text-sm mt-1">Add favorites in Settings</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {favoriteModels.map((model) => (
                        <Button
                          key={model.id}
                          variant="ghost"
                          className="w-full justify-start text-left h-auto p-3 hover:bg-secondary/80 transition-all duration-200"
                          onClick={() => selectModel(model)}
                        >
                          <div className="font-medium">{model.name}</div>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full p-2 hover:bg-secondary/80 transition-all duration-200"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0">
          <div className="w-full p-4 space-y-6 pb-24">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🤖</div>
                <h2 className="text-2xl font-semibold mb-2">Welcome to AI Chat</h2>
                <p className="text-muted-foreground">Start a conversation with your AI assistant</p>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-center"} mb-4`}
                    initial="hidden"
                    animate="visible"
                    variants={messageVariants}
                    custom={index}
                  >
                    {message.role === "user" ? (
                      <div className="flex flex-col items-end">
                        <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2 max-w-[calc(90vw-20px)] shadow-lg mr-[20px]">
              {/* Larger font for assistant responses for better readability */}
              <div className="prose prose-base md:prose-lg dark:prose-invert max-w-none break-words text-base md:text-lg [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_katex]:text-lg [&_katex-display]:text-lg">
                            <ReactMarkdown
                              components={{
                                ...MarkdownComponents,
                                code: (props:any) => <MarkdownCode {...props} isStreaming={message.isStreaming} />,
                              }}
                              remarkPlugins={[[remarkMath, { singleDollarTextMath: true }], remarkGfm]}
                              rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", trust: true }]]}
                            >
                              {normalizeMathDelimiters(message.content)}
                            </ReactMarkdown>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-1 pr-[20px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleCopyMessage(message)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteUserAndReply(message.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col items-center px-2 sm:px-0">
                        {(message.modelId === "glm-4.5-flash" && (message.isStreaming || (message.reasoningContent && message.reasoningContent.length > 0))) && (
                          <div className="w-[90vw] max-w-[90vw] mb-4">
                            <button
                              type="button"
                              onClick={() => toggleReasoningExpanded(message.id)}
                              className="w-full flex items-center justify-between bg-transparent"
                            >
                              <span className="inline-flex items-center gap-2 rounded-full bg-zinc-800 text-white px-2 py-1 text-xs md:text-sm">
                                <Brain className="h-3.5 w-3.5" />
                                <span>{message.isStreaming ? "Thinking..." : "Thinking completed"}</span>
                              </span>
                              <ChevronRight className={`h-3.5 w-3.5 text-white transition-transform ${(reasoningExpandedMap[message.id] ?? true) ? "rotate-90" : ""}`} />
                            </button>
                            {(reasoningExpandedMap[message.id] ?? true) && (
                              <div className="mt-2 pl-2 md:pl-3 text-xs md:text-sm text-muted-foreground/90 whitespace-pre-wrap">
                                {message.reasoningContent}
                              </div>
                            )}
                          </div>
                        )}
                        {!(message.modelId === "glm-4.5-flash" && message.isStreaming) && (
                          <>
                            <div className="bg-card border border-border rounded-2xl p-4 shadow-lg w-[90vw] max-w-[90vw]">
                              <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_katex]:text-sm [&_katex-display]:text-sm">
                                <ReactMarkdown
                                  components={{
                                    ...MarkdownComponents,
                                    code: (props:any) => <MarkdownCode {...props} isStreaming={message.isStreaming} />,
                                  }}
                                  remarkPlugins={[[remarkMath, { singleDollarTextMath: true }], remarkGfm]}
                                  rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", trust: true }]]}
                                >
                                  {normalizeMathDelimiters(message.content)}
                                </ReactMarkdown>
                              </div>
                            </div>
                            <div className="w-[90vw] max-w-[90vw] flex justify-end mt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => handleCopyMessage(message)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}

                {isGenerating && selectedModel?.id !== "glm-4.5-flash" && (
                  <motion.div
                    className="flex justify-center animate-fadeInUp"
                    initial="hidden"
                    animate="visible"
                    variants={messageVariants}
                  >
                    <div className="w-[90%] max-w-[calc(100vw-2rem)] sm:max-w-2xl lg:max-w-4xl px-2 sm:px-0">
                      <div className="bg-card border border-border rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                                style={{
                                  animationDelay: `${i * 0.2}s`,
                                  animationDuration: "1s",
                                }}
                                initial={{ scale: 1, opacity: 0.5 }}
                                animate={{ scale: 1.2, opacity: 1 }}
                                variants={typingVariants}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">AI is thinking...</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

  {/* Input Area */}
  <div className="sticky bottom-0 z-20 p-4 border-t border-border bg-card/30 backdrop-blur-sm">
          <div className="flex items-end space-x-3">
            <div className="flex-1 space-y-3">
              {/*
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Button
                    variant={webSearch ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWebSearch(!webSearch)}
                    className="rounded-full px-3 py-1 text-xs transition-all duration-200"
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    Web Search
                  </Button>
                  <Button
                    variant={think ? "default" : "outline"}
                    size="sm"
                    onClick={() => setThink(!think)}
                    className="rounded-full px-3 py-1 text-xs transition-all duration-200"
                  >
                    <Brain className="h-3 w-3 mr-1" />
                    Think
                  </Button>
                </div>
              </div>
              */}

              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <Textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your message..."
                    className="min-h-[44px] max-h-32 resize-none rounded-2xl border-border bg-background/50 backdrop-blur-sm focus:bg-background/80 transition-all duration-200"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                  />
                </div>
                {isGenerating ? (
                  <Button
                    onClick={stopGeneration}
                    variant="destructive"
                    className="rounded-full w-11 h-11 p-0 flex items-center justify-center transition-all duration-300 shadow-lg"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                    className="rounded-full w-11 h-11 p-0 flex items-center justify-center bg-primary hover:bg-primary/90 transition-all duration-300 shadow-lg disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="w-[480px] max-w-[90vw] max-h-[80vh] bg-card border-border overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Configure your AI chat preferences</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="space-y-2">
              <Label htmlFor="api-key">OpenRouter API Key</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={tempSettings.apiKey}
                  onChange={(e) => setTempSettings({ ...tempSettings, apiKey: e.target.value })}
                  placeholder="sk-or-v1-..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {tempSettings.apiKey && (
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-600">API Key configured</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Models</Label>
                <Button
                  onClick={fetchModels}
                  disabled={!tempSettings.apiKey || loadingModels}
                  size="sm"
                  variant="outline"
                  className="text-xs bg-transparent"
                >
                  {loadingModels ? "Loading..." : "Refresh Models"}
                </Button>
              </div>

              {models.length > 0 && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search models..."
                      value={modelSearch}
                      onChange={(e) => {
                        setModelSearch(e.target.value)
                        const filtered = models.filter(
                          (model) =>
                            model.name.toLowerCase().includes(e.target.value.toLowerCase()) ||
                            model.id.toLowerCase().includes(e.target.value.toLowerCase()),
                        )
                        setFilteredModels(filtered)
                      }}
                      className="pl-10"
                    />
                  </div>

                  <div className="h-32 overflow-y-auto space-y-1 border rounded-lg p-2 bg-background/50">
                    {filteredModels.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between p-2 hover:bg-secondary/50 rounded-lg transition-colors min-w-0"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-medium text-sm truncate max-w-full" title={model.name}>
                            {model.name}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFavoriteModel(model.id)}
                          className="flex-shrink-0 p-1 h-8 w-8"
                        >
                          <Star
                            className={`h-4 w-4 ${
                              tempSettings.favoriteModels.includes(model.id)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSettings}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

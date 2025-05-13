    // app/import-mcp/page.tsx
    "use client";

    import { useEffect, useState } from "react";
    import { useRouter, useSearchParams } from "next/navigation";
    import { toast } from "sonner";
    import { STORAGE_KEYS } from "@/lib/constants";
    import { MCPServer } from "@/lib/context/mcp-context";
    import { Loader2 } from "lucide-react";

    // 辅助类型，表示从外部导入的配置结构
    interface ImportConfig {
      sitekey: string;
      mcpServers: Array<Omit<MCPServer, 'id'> & { id?: string }>; // 允许传入可选的 id
    }

    export default function ImportMcpConfigPage() {
      const router = useRouter();
      const searchParams = useSearchParams();
      const [status, setStatus] = useState<string>("正在处理配置...");
      const [error, setError] = useState<string | null>(null);

      useEffect(() => {
        const encodedConfig = searchParams.get("config");
        const siteKeyEnv = process.env.NEXT_PUBLIC_ALLOWED_SITEKEY;

        if (!siteKeyEnv) {
            console.error("错误：环境变量 NEXT_PUBLIC_ALLOWED_SITEKEY 未设置。");
            setError("服务器配置错误，无法导入。");
            setStatus("导入失败");
            toast.error("导入失败：服务器未正确配置校验密钥。");
            return;
        }


        if (!encodedConfig) {
          setError("URL 中未找到 'config' 参数。");
          setStatus("无效请求");
          toast.error("无效请求：缺少配置参数。");
          // 可以选择重定向或显示错误信息
          // router.push("/"); 
          return;
        }

        try {
          const decodedConfig = atob(encodedConfig);
          const config: ImportConfig = JSON.parse(decodedConfig);

          // 1. 校验 Site Key
          if (config.sitekey !== siteKeyEnv) {
            throw new Error("无效的 sitekey。");
          }

          // 2. 校验并处理 MCP Servers
          if (!Array.isArray(config.mcpServers)) {
            throw new Error("配置格式错误：'mcpServers' 必须是一个数组。");
          }

          const importedServers: MCPServer[] = config.mcpServers.map(server => {
            // 简单校验必需字段 (可根据需要扩展)
            if (!server.name || !server.type || (server.type === 'sse' && !server.url) || (server.type === 'stdio' && !server.command)) {
              console.warn("跳过无效的服务器配置:", server);
              return null; // 标记为无效，稍后过滤掉
            }
            const id = server.id ?? crypto.randomUUID(); // 如果没有提供 id，则生成一个新的
            return { ...server, id };
          }).filter((s): s is MCPServer => s !== null); // 过滤掉无效的条目

          if (importedServers.length === 0 && config.mcpServers.length > 0) {
             throw new Error("提供的所有服务器配置均无效。");
          }
          
          const importedServerIds = importedServers.map(s => s.id);

          // 3. 更新 localStorage
          // 注意：这里我们直接替换现有的配置和选择。如果需要合并，逻辑会更复杂。
          window.localStorage.setItem(STORAGE_KEYS.MCP_SERVERS, JSON.stringify(importedServers));
          window.localStorage.setItem(STORAGE_KEYS.SELECTED_MCP_SERVERS, JSON.stringify(importedServerIds));

          setStatus("配置导入成功！正在重定向...");
          toast.success(`成功导入 ${importedServers.length} 个 MCP 服务器配置。`);

          // 4. 重定向回主页
          setTimeout(() => {
            router.push("/");
          }, 1500); // 延迟一点让用户看到成功消息

        } catch (err: any) {
          console.error("导入 MCP 配置时出错:", err);
          setError(`导入失败: ${err.message || '无法解析配置。'}`);
          setStatus("导入失败");
          toast.error(`导入失败: ${err.message || '请检查配置链接是否正确。'}`);
        }
      }, [searchParams, router]);

      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <h1 className="text-2xl font-semibold mb-4">MCP 服务器配置导入</h1>
          {error ? (
            <div className="text-red-500 dark:text-red-400">
              <p className="text-lg font-medium">错误</p>
              <p>{error}</p>
              <button 
                onClick={() => router.push('/')}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                返回主页
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">{status}</p>
            </div>
          )}
        </div>
      );
    }
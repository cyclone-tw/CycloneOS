import { ResizableLayout } from "@/components/layout/resizable-layout";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function Home() {
  return <ResizableLayout chatPanel={<ChatPanel />} />;
}

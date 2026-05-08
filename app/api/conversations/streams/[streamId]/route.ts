import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { createChatEventStreamResponse, LumoRouteError } from "@/lib/chat-stream";
import { isLumoAiConfigured } from "@/lib/gemini";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    streamId: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "로그인 후에만 채팅 스트림을 열 수 있습니다." },
      { status: 401 },
    );
  }

  if (!isLumoAiConfigured()) {
    return NextResponse.json(
      { error: "루모 AI 연결 키가 없어 아직 채팅을 생성할 수 없습니다." },
      { status: 503 },
    );
  }

  try {
    const { streamId } = await context.params;
    const lastEventIdHeader = request.headers.get("last-event-id");
    const lastEventId = Number.parseInt(lastEventIdHeader ?? "-1", 10);

    return await createChatEventStreamResponse(
      streamId,
      userId,
      Number.isNaN(lastEventId) ? -1 : lastEventId,
      request.signal,
    );
  } catch (error) {
    if (error instanceof LumoRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "루모 AI 채팅 생성 중 알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}

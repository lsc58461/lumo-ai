import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { createChatStreamJob, isChatRequestPayload, LumoRouteError } from "@/lib/chat-stream";
import { isLumoAiConfigured } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as unknown;

  if (!isChatRequestPayload(body)) {
    return NextResponse.json({ error: "잘못된 채팅 요청 형식입니다." }, { status: 400 });
  }

  if (!body.profile.trim() || !body.question.trim()) {
    return NextResponse.json(
      { error: "출생 정보와 질문을 모두 입력해 주세요." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const userName = session?.user?.name ?? null;
  const userImage = session?.user?.image ?? null;

  if (!userId) {
    return NextResponse.json(
      { error: "로그인 후에만 채팅을 보낼 수 있습니다." },
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
    const streamJob = await createChatStreamJob(body, userId, userName, userImage);
    return NextResponse.json(streamJob);
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

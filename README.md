# Lumo AI

루모 AI는 빛을 뜻하는 라틴어 감각을 섞어, 운명을 더 선명하게 밝혀준다는 인상을 주는 무료형 AI 사주 플랫폼 MVP입니다.

현재 범위는 아래에 집중합니다.

- 결제 없는 무료 베타 홈
- 채팅형 상담 프롬프트 설계 경험
- MongoDB 기반 데이터 구조 준비
- Gemini 연결 전 단계의 질문 템플릿 및 세션 구조 설계

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- ESLint 9 + eslint-config-airbnb-extended
- Prettier + prettier-plugin-tailwindcss
- MongoDB Node.js Driver

## Getting Started

1. 환경 변수 파일을 준비합니다.

```bash
cp .env.example .env.local
```

2. `.env.local`에 MongoDB 연결 정보를 넣습니다.

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=lumo_ai
```

3. 개발 서버를 실행합니다.

```bash
npm install
npm run dev
```

4. 브라우저에서 http://localhost:3000 을 엽니다.

MongoDB 연결 정보가 없으면 홈 화면은 자동으로 seed 데이터로 폴백됩니다.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## MongoDB Collections

### promptTemplates

- 홈에서 보여줄 추천 질문
- 카테고리, 도구 조합, 말투 정보 저장

### userProfiles

- 출생 정보와 선호 말투 저장
- 추후 로그인 사용자별 프로필 확장 포인트

### readingSessions

- 질문, 응답, 선택한 도구, 저장 여부를 세션 단위로 보관
- 사이드바 히스토리와 최근 대화 프리뷰에 사용

## Notes

- 호리 AI의 결제 구조는 이번 MVP 범위에서 제외했습니다.
- 현재 홈은 무료 버전용 설계와 데이터 구조 정리에 집중합니다.
- 일부 ESLint 하위 의존성은 Node 20.19+를 권장합니다. 현재 20.18.1에서도 동작은 하지만, 장기적으로는 Node를 올리는 편이 안전합니다.

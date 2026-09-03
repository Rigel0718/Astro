export const POST_TOPICS = {
  python: {
    slug: "python",
    title: "Python 개념 톺아보기",
    description: "바이브코딩 시대에 Python 개발자가 알아야 할 개념들",
    series: {
      understandingPythonObjects: {
        slug: "understanding-python-objects",
        title: "파이썬 객체에 대한 이해",
        description:
          "Python에서 객체란 무엇이고, 실제로 어떻게 동작할까?\n변수와 객체의 관계부터 메모리, Attribute 탐색, 상속과 객체의 생명주기까지 차근차근 살펴봅니다.",
        metaDescription:
          "파이썬 객체의 핵심 개념을 순서대로 살펴보는 8개 에피소드 시리즈입니다.",
        episodeCount: 8,
      },
    },
  },
} as const;

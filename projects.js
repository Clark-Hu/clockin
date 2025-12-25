export const DEFAULT_PROJECT_CATEGORIES = [
  {
    id: "chinese",
    name: "语文",
    projects: [
      { id: "cn_reading", name: "阅读理解", frequencyDays: 2, quantity: "一篇" },
      { id: "cn_essay", name: "作文", frequencyDays: 7, quantity: "一篇" },
      { id: "cn_intensive", name: "精读", frequencyDays: 1, quantity: "一篇" },
      { id: "cn_extensive", name: "泛读", frequencyDays: 1, quantity: "一次" },
    ],
  },
  {
    id: "math",
    name: "数学",
    projects: [
      { id: "math_calc", name: "计算", frequencyDays: 1, quantity: "1页" },
      { id: "math_practice", name: "学而思练习/101/试卷", frequencyDays: 1, quantity: "1页" },
    ],
  },
  {
    id: "english",
    name: "英语",
    projects: [
      { id: "en_1000", name: "1000词", frequencyDays: 1, quantity: "1页" },
      { id: "en_intensive", name: "精读", frequencyDays: 2, quantity: "一章" },
      { id: "en_extensive", name: "泛读", frequencyDays: 1, quantity: "一次" },
      { id: "en_reading", name: "阅读理解", frequencyDays: 2, quantity: "两篇" },
    ],
  },
  {
    id: "other",
    name: "其他",
    projects: [{ id: "drum", name: "练鼓", frequencyDays: 1, quantity: "半小时" }],
  },
];


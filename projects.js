export const DEFAULT_PROJECT_CATEGORIES = [
  {
    id: "chinese",
    name: "语文",
    projects: [
      { id: "cn_reading", name: "阅读理解", frequency: "两天一篇" },
      { id: "cn_essay", name: "作文", frequency: "一周一篇" },
      { id: "cn_intensive", name: "精读", frequency: "一天一篇" },
      { id: "cn_extensive", name: "泛读", frequency: "每天" },
    ],
  },
  {
    id: "math",
    name: "数学",
    projects: [
      { id: "math_calc", name: "计算", frequency: "一天1页" },
      { id: "math_practice", name: "学而思练习/101/试卷", frequency: "每天一页" },
    ],
  },
  {
    id: "english",
    name: "英语",
    projects: [
      { id: "en_1000", name: "1000词", frequency: "每天一页" },
      { id: "en_intensive", name: "精读", frequency: "两天一章" },
      { id: "en_extensive", name: "泛读", frequency: "每天" },
      { id: "en_reading", name: "阅读理解", frequency: "两天两篇" },
    ],
  },
  {
    id: "other",
    name: "其他",
    projects: [{ id: "drum", name: "练鼓", frequency: "每天半个小时" }],
  },
];


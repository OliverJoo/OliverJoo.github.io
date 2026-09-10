"use strict";

// GitHub API Rate Limit(403) 또는 오프라인 대비 로컬 폴백 데이터
const FALLBACK_REPOS = [
  {
    name: "codyssey_ai",
    description: "Codyssey All-In-One AI & Software Learning Repository",
    html_url: "https://github.com/OliverJoo/codyssey_ai",
    language: "Python",
    stargazers_count: 5,
    forks_count: 1,
  },
  {
    name: "pentagi---openai-security-agi",
    description: "Fully autonomous AI Agents system capable of performing complex penetration testing tasks",
    html_url: "https://github.com/OliverJoo/pentagi---openai-security-agi",
    language: "Python",
    stargazers_count: 3,
    forks_count: 0,
  },
  {
    name: "nanoclaw-aibot",
    description: "A lightweight alternative to Clawdbot / OpenClaw that runs in Apple containers for security.",
    html_url: "https://github.com/OliverJoo/nanoclaw-aibot",
    language: "TypeScript",
    stargazers_count: 2,
    forks_count: 0,
  },
  {
    name: "planning-with-files",
    description: "Claude Code skill implementing Manus-style persistent markdown planning.",
    html_url: "https://github.com/OliverJoo/planning-with-files",
    language: "Markdown",
    stargazers_count: 2,
    forks_count: 0,
  },
  {
    name: "LLM-LangChain",
    description: "Test LLM Application with LangChain & Huggingface_hub",
    html_url: "https://github.com/OliverJoo/LLM-LangChain",
    language: "Jupyter Notebook",
    stargazers_count: 1,
    forks_count: 0,
  },
  {
    name: "gps_map_flutter",
    description: "GPS Google Map Flutter application",
    html_url: "https://github.com/OliverJoo/gps_map_flutter",
    language: "Dart",
    stargazers_count: 4,
    forks_count: 0,
  },
  {
    name: "flutter-class",
    description: "Flutter programming class and practice projects",
    html_url: "https://github.com/OliverJoo/flutter-class",
    language: "Dart",
    stargazers_count: 4,
    forks_count: 0,
  },
  {
    name: "david",
    description: "Python data & AI application",
    html_url: "https://github.com/OliverJoo/david",
    language: "Python",
    stargazers_count: 2,
    forks_count: 0,
  },
];

// 화면에 영향을 주는 값을 한곳에서 관리한다.
const state = {
  theme: localStorage.getItem("portfolio-theme") || "",
  menuOpen: false,
  projects: {
    status: "idle",
    username: document.body.dataset.githubUsername || "OliverJoo",
    items: [],
    filter: "All",
    error: "",
  },
  form: { errors: {} },
};

const elements = {
  header: document.querySelector(".site-header"),
  menuButton: document.querySelector(".menu-toggle"),
  menu: document.querySelector(".nav-menu"),
  themeButton: document.querySelector(".theme-toggle"),
  scrollTopButton: document.querySelector(".scroll-top"),
  projectList: document.querySelector("#project-list"),
  projectStatus: document.querySelector("#project-status"),
  projectFilters: document.querySelector("#project-filters"),
  githubForm: document.querySelector("#github-search"),
  githubInput: document.querySelector("#github-username"),
  contactForm: document.querySelector("#contact-form"),
  formResult: document.querySelector("#form-result"),
};

// API 문자열을 innerHTML에 넣기 전에 특수문자를 이스케이프한다.
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[character]);

const getInitialTheme = () => {
  if (state.theme) return state.theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

// 테마 상태가 바뀔 때 문서 속성과 버튼 설명을 함께 갱신한다.
const renderTheme = () => {
  const isDark = state.theme === "dark";
  document.documentElement.dataset.theme = state.theme;
  elements.themeButton.setAttribute("aria-pressed", String(isDark));
  elements.themeButton.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
};

const setTheme = (theme, persist = true) => {
  state.theme = theme;
  if (persist) localStorage.setItem("portfolio-theme", theme);
  renderTheme();
};

// 모바일 메뉴 상태를 class와 접근성 속성에 반영한다.
const renderMenu = () => {
  elements.menu.classList.toggle("active", state.menuOpen);
  elements.menuButton.setAttribute("aria-expanded", String(state.menuOpen));
  elements.menuButton.querySelector(".sr-only").textContent = state.menuOpen ? "메뉴 닫기" : "메뉴 열기";
  document.body.classList.toggle("menu-open", state.menuOpen);
};

const setMenuOpen = (isOpen) => {
  state.menuOpen = isOpen;
  renderMenu();
};

const renderProjectFilters = () => {
  const languages = ["All", ...new Set(state.projects.items.map(({ language }) => language || "Other"))];
  elements.projectFilters.innerHTML = languages.map((language) => `
    <button class="filter-button${state.projects.filter === language ? " active" : ""}"
      type="button" data-language="${escapeHtml(language)}">${escapeHtml(language)}</button>
  `).join("");
};

// loading, error, empty, success 상태를 서로 다른 UI로 렌더링한다.
const renderProjects = () => {
  const { status, items, filter, error } = state.projects;
  elements.projectList.innerHTML = "";

  if (status === "loading") {
    elements.projectStatus.innerHTML = '<span class="spinner" aria-hidden="true"></span>프로젝트를 불러오는 중입니다.';
    elements.projectFilters.innerHTML = "";
    return;
  }

  if (status === "error") {
    elements.projectStatus.innerHTML = `${escapeHtml(error)} <button class="button compact retry-button" type="button" data-action="retry">다시 시도</button> <button class="button compact fallback-button" type="button" data-action="fallback">샘플 데이터 보기</button>`;
    elements.projectFilters.innerHTML = "";
    return;
  }

  if (status !== "success") return;
  renderProjectFilters();
  const filtered = filter === "All"
    ? items
    : items.filter(({ language }) => (language || "Other") === filter);

  if (filtered.length === 0) {
    elements.projectStatus.textContent = filter === "All" ? "표시할 프로젝트가 없습니다." : `${filter} 프로젝트가 없습니다.`;
    return;
  }

  elements.projectStatus.textContent = `${filtered.length}개의 프로젝트를 표시합니다.`;
  elements.projectList.innerHTML = filtered.map((repo) => {
    const { name, description, html_url: url, language, stargazers_count: stars, forks_count: forks } = repo;
    return `
      <article class="project-card">
        <span class="project-language">${escapeHtml(language || "Other")}</span>
        <h3><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(name)}</a></h3>
        <p>${escapeHtml(description || "설명이 등록되지 않은 프로젝트입니다.")}</p>
        <div class="project-meta"><span>★ ${Number(stars)}</span><span>⑂ ${Number(forks)}</span></div>
      </article>
    `;
  }).join("");
};

const loadProjects = async (username = state.projects.username) => {
  state.projects = { ...state.projects, status: "loading", username, filter: "All", error: "" };
  renderProjects();

  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=12`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) {
      const hint = response.status === 403 ? "API 호출 한도를 확인해 주세요." : "사용자 이름과 네트워크를 확인해 주세요.";
      throw new Error(`프로젝트를 불러올 수 없습니다. (${response.status}) ${hint}`);
    }
    const data = await response.json();
    state.projects = { ...state.projects, status: "success", items: Array.isArray(data) ? data : [] };
  } catch (error) {
    state.projects = { ...state.projects, status: "error", items: [], error: error.message || "프로젝트를 불러올 수 없습니다." };
  }
  renderProjects();
};

const validationMessage = (field) => {
  const value = field.value.trim();
  if (!value) return `${field.labels[0].textContent}을(를) 입력해 주세요.`;
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "올바른 이메일 형식을 입력해 주세요.";
  if (field.name === "message" && value.length < 10) return "메시지는 10자 이상 입력해 주세요.";
  return "";
};

// 입력 상태가 바뀌면 해당 필드의 오류 UI만 즉시 갱신한다.
const validateField = (field) => {
  const message = validationMessage(field);
  state.form.errors[field.name] = message;
  field.setAttribute("aria-invalid", String(Boolean(message)));
  document.querySelector(`#${field.name}-error`).textContent = message;
  return !message;
};

const initializeRevealAnimation = () => {
  const targets = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    targets.forEach((target) => target.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  targets.forEach((target) => observer.observe(target));
};

const initializeTypingEffect = () => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = document.querySelector("#typing-text");
  const words = ["금융 데이터 분석가", "AI & 플러터 개발자", "문제 해결자"];
  let wordIndex = 0;
  let characterIndex = words[0].length;
  let deleting = true;
  const type = () => {
    const word = words[wordIndex];
    characterIndex += deleting ? -1 : 1;
    target.textContent = word.slice(0, characterIndex);
    if (characterIndex === 0) { deleting = false; wordIndex = (wordIndex + 1) % words.length; }
    if (characterIndex === words[wordIndex].length) deleting = true;
    window.setTimeout(type, deleting ? 90 : 130);
  };
  window.setTimeout(type, 900);
};

// 화면의 사용자 이벤트를 상태 변경 함수와 연결한다.
elements.menuButton.addEventListener("click", () => setMenuOpen(!state.menuOpen));
elements.themeButton.addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    setMenuOpen(false);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

window.addEventListener("scroll", () => {
  elements.header.classList.toggle("scrolled", window.scrollY >= 60);
  elements.scrollTopButton.classList.toggle("visible", window.scrollY >= 300);
}, { passive: true });

elements.scrollTopButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

elements.githubForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = elements.githubInput.value.trim();
  if (username) loadProjects(username);
});

elements.projectFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-language]");
  if (!button) return;
  state.projects.filter = button.dataset.language;
  renderProjects();
});

elements.projectStatus.addEventListener("click", (event) => {
  if (event.target.closest('[data-action="retry"]')) loadProjects();
  if (event.target.closest('[data-action="fallback"]')) {
    state.projects = { ...state.projects, status: "success", items: FALLBACK_REPOS, filter: "All", error: "" };
    renderProjects();
  }
});

// 입력할 때마다 현재 필드만 검증해 빠르게 피드백한다.
elements.contactForm.querySelectorAll("input, textarea").forEach((field) => {
  field.addEventListener("input", () => {
    validateField(field);
    elements.formResult.textContent = "";
  });
});

elements.contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const fields = [...elements.contactForm.querySelectorAll("input, textarea")];
  const isValid = fields.map(validateField).every(Boolean);
  elements.formResult.textContent = isValid ? "입력 확인이 완료되었습니다. 데모 폼이므로 실제 전송은 하지 않습니다." : "입력 내용을 다시 확인해 주세요.";
  if (isValid) elements.contactForm.reset();
});

// 초기 상태를 화면에 한 번 렌더링한다.
state.theme = getInitialTheme();
renderTheme();
renderMenu();
elements.githubInput.value = state.projects.username;
document.querySelector("#current-year").textContent = new Date().getFullYear();
initializeRevealAnimation();
initializeTypingEffect();
loadProjects();

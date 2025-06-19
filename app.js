const supabaseUrl = "https://sueahkavaigvtwqamnxm.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1ZWFoa2F2YWlndnR3cWFtbnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4MDQ5NTYsImV4cCI6MjA2NDM4MDk1Nn0.6zkizLKYR_58MtXeMiILpAAEDWm2KkkIAnyuPsqcIws";

export const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true },
});

const currentPath = location.pathname.split("/").pop();

if (currentPath === "login.html") {
  initLoginPage();
} else {
  initMainPage();
}

function initLoginPage() {
  const form = document.getElementById("login-form");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const { email, password } = Object.fromEntries(formData.entries());

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      return;
    }

    location.href = "index.html";
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) location.href = "index.html";
  });
}

function initMainPage() {
  const navActions = document.getElementById("nav-actions");
  const articlesContainer = document.getElementById("articles");
  const modal = document.getElementById("article-modal");
  const form = document.getElementById("article-form");

  let editingId = null;

  const closeModal = () => modal.close();

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  modal.querySelectorAll("[data-close]").forEach((btn) => {
    btn.onclick = closeModal;
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    renderNavbar(!!session);
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    renderNavbar(!!data.session);
  });

  function renderNavbar(isLoggedIn) {
    if (isLoggedIn) {
      navActions.innerHTML = `
        <button id="add-btn" class="px-3 py-1 bg-indigo-600 text-white rounded-md transition hover:bg-indigo-700">
          + Dodaj artykuł
        </button>
        <button id="logout-btn" class="px-3 py-1 text-indigo-600 rounded-md border border-indigo-600 hover:bg-indigo-50 transition">
          Wyloguj
        </button>
      `;

      document.getElementById("add-btn").onclick = () => openModal();
      document.getElementById("logout-btn").onclick = async () => {
        await supabaseClient.auth.signOut();
        location.href = "login.html";
      };
    } else {
      navActions.innerHTML = `
        <a href="login.html" class="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
          Zaloguj
        </a>
      `;
    }
  }

  async function fetchAndRenderArticles() {
    const { data, error } = await supabaseClient
      .from("article2")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }
    renderArticles(data);
  }

  async function renderArticles(articles) {
    const canEdit = await showEditButtons();
    articlesContainer.innerHTML = articles
      .map(
        (a) => `
      <article class="bg-white rounded-xl shadow p-6 space-y-2">
        <header>
          <h2 class="text-xl font-semibold">${escape(a.title)}</h2>
          ${
            a.subtitle
              ? `<p class="text-sm text-gray-600">${escape(a.subtitle)}</p>`
              : ""
          }
          <p class="text-xs text-gray-500">
            ${escape(a.author ?? "Anonim")} •
            ${new Date(a.created_at).toLocaleString("pl-PL")}
          </p>
        </header>
        <p class="whitespace-pre-line">${escape(a.content)}</p>
        ${
          canEdit
            ? `<footer class="flex gap-2 pt-4">
                <button data-edit="${a.id}" class="px-3 py-1 rounded-md bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 transition">
                  Edytuj
                </button>
                <button data-del="${a.id}" class="px-3 py-1 rounded-md bg-red-500/20 text-red-700 hover:bg-red-500/30 transition">
                  Usuń
                </button>
              </footer>`
            : ""
        }
      </article>`
      )
      .join("");

    articlesContainer.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.onclick = () => openModal(btn.dataset.edit);
    });

    articlesContainer.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = () => deleteArticle(btn.dataset.del);
    });
  }

  async function showEditButtons() {
    const { data } = await supabaseClient.auth.getSession();
    return !!data.session;
  }

  async function deleteArticle(id) {
    if (!confirm("Usunąć artykuł?")) return;

    const { error } = await supabaseClient.from("article2").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    fetchAndRenderArticles();
  }

  function openModal(id = null) {
    editingId = id;
    form.reset();

    if (id) {
      supabaseClient
        .from("article2")
        .select("*")
        .eq("id", id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            alert(error.message);
            return;
          }
          form.title.value = data.title;
          form.subtitle.value = data.subtitle ?? "";
          form.content.value = data.content;
          form.author.value = data.author ?? "";
          modal.querySelector("#article-modal-title").textContent = "Edytuj artykuł";
          modal.showModal();
        });
    } else {
      modal.querySelector("#article-modal-title").textContent = "Nowy artykuł";
      modal.showModal();
    }
  }

  form.onsubmit = async (e) => {
    e.preventDefault();

    const { title, subtitle, content, author } = Object.fromEntries(new FormData(form).entries());
    const payload = {
      title,
      subtitle,
      content,
      author,
      created_at: new Date().toISOString(),
    };

    let error;
    if (editingId) {
      ({ error } = await supabaseClient.from("article2").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabaseClient.from("article2").insert(payload));
    }

    if (error) {
      alert(error.message);
      return;
    }

    closeModal();
    fetchAndRenderArticles();
  };

  const escape = (str) =>
    str?.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[c])) ?? "";

  fetchAndRenderArticles();
}

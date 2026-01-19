/**
 * Clinic Note - Frontend App Logic
 * Alpine.js Controller
 */

document.addEventListener("alpine:init", () => {
  Alpine.data("clinicNoteApp", () => ({
    /* =============================
       State
    ============================= */
    lang: "ja",
    username: "",
    password: "",
    isAuthenticated: false,

    selectedDate: new Date().toISOString().split("T")[0],
    memo: "",
    memos: {},

    apiBase: "https://clinic-note-api.onrender.com",

    /* =============================
       Initialization
    ============================= */
    init() {
      const auth = localStorage.getItem("clinic-note-auth");
      if (auth === "true") {
        this.isAuthenticated = true;
      }

      const savedMemos = localStorage.getItem("clinic-note-memos");
      if (savedMemos) {
        this.memos = JSON.parse(savedMemos);
      }

      if (this.memos[this.selectedDate]) {
        this.memo = this.memos[this.selectedDate];
      }
    },

    /* =============================
       Language Switch
    ============================= */
    switchLang(language) {
      this.lang = language;
    },

    /* =============================
       Authentication (Pseudo BASIC)
    ============================= */
    async login() {
      if (!this.username || !this.password) {
        alert("Username and password are required");
        return;
      }

      try {
        const response = await fetch(
          `${this.apiBase}/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              username: this.username,
              password: this.password
            })
          }
        );

        if (!response.ok) {
          throw new Error("Authentication failed");
        }

        const result = await response.json();

        if (result.success) {
          this.isAuthenticated = true;
          localStorage.setItem("clinic-note-auth", "true");
        } else {
          alert("Invalid credentials");
        }
      } catch (error) {
        console.error(error);
        alert("Login error");
      }
    },

    logout() {
      this.isAuthenticated = false;
      localStorage.removeItem("clinic-note-auth");
    },

    /* =============================
       Calendar & Memo Handling
    ============================= */
    selectDate(date) {
      this.selectedDate = date;

      if (this.memos[date]) {
        this.memo = this.memos[date];
      } else {
        this.memo = "";
      }
    },

    saveMemo() {
      if (!this.selectedDate) return;

      this.memos[this.selectedDate] = this.memo;
      localStorage.setItem(
        "clinic-note-memos",
        JSON.stringify(this.memos)
      );

      alert("Memo saved");
    },

    loadMemo() {
      if (this.memos[this.selectedDate]) {
        this.memo = this.memos[this.selectedDate];
      } else {
        alert("No memo for this date");
      }
    },

    /* =============================
       Utility
    ============================= */
    today() {
      return new Date().toISOString().split("T")[0];
    }
  }));
});

const API = 'https://clinic-note-api.onrender.com'

function app() {
  return {
    lang: 'ja',
    dict: {},
    username: '',
    password: '',
    loggedIn: false,
    memo: localStorage.getItem('memo') || '',

    async init() {
      await this.loadLang()
    },

    async loadLang() {
      const res = await fetch(`/i18n/${this.lang}.json`)
      this.dict = await res.json()
    },

    t(key) {
      return this.dict[key] ?? key
    },

    async login() {
      const token = btoa(`${this.username}:${this.password}`)
      const res = await fetch(`${API}/api/health`, {
        headers: { Authorization: `Basic ${token}` }
      })
      if (res.ok) {
        this.loggedIn = true
        localStorage.setItem('auth', token)
      } else {
        alert('Login failed')
      }
    },

    async saveMemo() {
      localStorage.setItem('memo', this.memo)
      alert(this.t('saved'))
    }
  }
}

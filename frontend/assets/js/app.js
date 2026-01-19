function app() {
  return {
    username: '',
    password: '',
    loggedIn: false,
    memo: '',

    init() {
      console.log('Alpine initialized');
    },

    async login() {
      const res = await fetch('https://clinic-note-api.onrender.com/auth/login', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(this.username + ':' + this.password)
        }
      });

      if (res.ok) {
        this.loggedIn = true;
      } else {
        alert('Login failed');
      }
    },

    async saveMemo() {
      await fetch('https://clinic-note-api.onrender.com/memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: this.memo })
      });
      alert('Saved');
    },

    async loadMemo() {
      const res = await fetch('https://clinic-note-api.onrender.com/memo');
      const data = await res.json();
      this.memo = data.memo || '';
    }
  }
}

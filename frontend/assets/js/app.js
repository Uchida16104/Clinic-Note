function app() {
  return {
    lang: 'en',
    dict: {},
    memo: localStorage.getItem('todayMemo') || '',

    async init() {
      await this.loadLang();
    },

    async loadLang() {
      const res = await fetch(`/i18n/${this.lang}.json`);
      this.dict = await res.json();
    },

    t(key) {
      return this.dict[key] || key;
    },

    saveMemo() {
      localStorage.setItem('todayMemo', this.memo);
      alert(this.t('saved'));
    }
  }
}

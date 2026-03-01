<template>
  <div class="scraper">
    <h1>Générer une démo</h1>

    <form @submit.prevent="generateJson">
      <label for="url">URL du site web à scraper</label>
      <input
        id="url"
        v-model="url"
        type="url"
        placeholder="https://exemple.fr"
        required
      />
      <button type="submit" :disabled="loading">
        {{ loading ? 'Scraping...' : 'Générer' }}
      </button>
    </form>

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="result" class="result">
      <div class="actions">
        <button @click="copyJson">Copier le JSON</button>
        <button @click="downloadJson">Télécharger</button>
      </div>
      <pre>{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'ScraperDemo',

  data() {
    return {
      url: '',
      result: null,
      loading: false,
      error: null,
    }
  },

  methods: {
    async generateJson() {
        this.loading = true
        this.error = null
        this.result = null

        try {
            const { data } = await axios.post('/scrape', { url: this.url })
            this.result = data
            this.downloadJson()
        } catch (err) {
            this.error = err.response?.data?.error ?? 'Une erreur est survenue.'
        } finally {
            this.loading = false
        }
    },

    downloadJson() {
        const filename = this.url
            .replace(/https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\.[a-z]{2,}$/, '')
            .replace(/[^a-zA-Z0-9-]/g, '-')
            + '.json'

        const blob = new Blob([JSON.stringify(this.result, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
        URL.revokeObjectURL(a.href)
    },

    copyJson() {
      navigator.clipboard.writeText(JSON.stringify(this.result, null, 2))
    }
  },
}
</script>

<style scoped></style>
<template>
  <router-link :to="'/demo'">Demo</router-link>
  <div class="pipeline">

    <!-- ÉTAPE 1 -->
    <section v-if="currentStep === 1">
      <h2>Qu'est-ce qu'on scrappe ? 👇🏼</h2>
      <div class="buttons">
        <button @click="pageMode = 'single'" :class="{ active: pageMode === 'single' }">Une page</button>
        <button @click="pageMode = 'multiple'" :class="{ active: pageMode === 'multiple' }">Plusieurs pages</button>
      </div>
      <div v-if="pageMode === 'single'" class="inputs">
        <input type="number" v-model="pageStart" min="1" />
      </div>
      <div v-if="pageMode === 'multiple'" class="inputs" style="margin-left: 15px;">
        <label>De</label>
        <input type="number" v-model="pageStart" min="1" />
        <label>à</label>
        <input type="number" v-model="pageEnd" min="1" />
      </div>
      
      <button v-if="pageMode" @click="goToStep2()" class="continuer">Continuer</button>
    </section>

    <!-- ÉTAPE 2 -->
    <section v-if="currentStep === 2">
      <h2>On démarre où ? 👇🏼</h2>
      
      <div class="buttons" style="display: flex;align-items: center;">
        <button @click="startCity = ''; goToStep3()">Depuis le début</button>

        <div class="inputs" style="margin-top: 0px;">
            <label for="">ou</label>
            <input type="text" v-model="startCity" placeholder="Ex: Lyon" />

            <button @click="goToStep3()" :disabled="!startCity">Depuis {{ startCity || '...' }}</button>
        </div>
      </div>
    </section>

    <!-- ÉTAPE 3 -->
    <section v-if="currentStep === 3">
      <h2>Quelle est la cible ? 👇🏼</h2>
      <div class="inputs">
        <input type="text" v-model="niche" placeholder="Ex: Agence de rénovation" />
      </div>
      <div class="buttons">
        <button @click="goToStep4()" :disabled="!niche">Lancer le scraping</button>
      </div>
    </section>

    <!-- ÉTAPE 4 -->
    <section v-if="currentStep === 4">
        <h2>Scraping en cours...</h2>
        <p class="live-city">📍 {{ liveCity || '...' }}</p>
        <p class="live-company">🏢 {{ liveCompany || '...' }}</p>
        <div class="buttons">
            <button @click="pauseScraping()">{{ scrapingActive ? 'Pause' : 'Reprendre' }}</button>
            <button @click="stopScraping()">Arrêter et télécharger</button>
        </div>
    </section>

  </div>
</template>

<script>
import axios from 'axios';
export default {
  name: "HomePage",
  data() {
    return {
      currentStep: 1,
      pageMode: null,
      pageStart: null,
      pageEnd: null,
      startCity: '',
      cities: [],
      niche: '',
      liveCity: '',
      liveCompany: '',
      scrapingActive: true,
      eventSource: null,
      allResults: [],
    }
  },
  methods: {
    goToStep2() {
      if (!this.pageStart) return;
      if (this.pageMode === 'multiple' && !this.pageEnd) return;
      this.currentStep = 2;
    },

    async goToStep3() {
      try {
        const allCities = [];
        const end = this.pageMode === 'single' ? Number(this.pageStart) : Number(this.pageEnd);

        for (let p = Number(this.pageStart); p <= end; p++) {
          const res = await axios.post('/step1', { page: p });
          allCities.push(...res.data.data);
        }

        if (this.startCity) {
          const idx = allCities.findIndex(c => c.toLowerCase() === this.startCity.toLowerCase());
          if (idx !== -1) {
            this.cities = allCities.slice(idx);
          } else {
            alert(`Ville "${this.startCity}" non trouvée dans la liste.`);
            return;
          }
        } else {
          this.cities = allCities;
        }

        this.currentStep = 3;
      } catch (err) {
        console.error('Erreur chargement villes :', err);
      }
    },

    async goToStep4() {
      if (!this.niche) return;
      this.currentStep = 4;
      await this.step3();
    },

    pauseScraping() {
    this.scrapingActive = !this.scrapingActive;
    },

    stopScraping() {
        if (this.eventSource) {
            this.eventSource.close();
        }
        this.generateCSV(this.allResults);
        this.currentStep = 1;
    },

    generateCSV(allResults) {
    const rows = [["Ville", "Nom", "Note", "Site Web", "Email"]];
    allResults.forEach(cityObj => {
        cityObj.results.forEach(r => {
        rows.push([cityObj.city, r.name || "", r.rating || "", r.website || "", r.emails || ""]);
        });
    });
    const csvContent = rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${this.niche}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    },

    async step3() {
    this.allResults = [];
    this.scrapingActive = true;

    const params = new URLSearchParams({
        cities: JSON.stringify(this.cities),
        niche: this.niche
    });

    this.eventSource = new EventSource(`http://localhost:3001/scrape-maps?${params}`);

    this.eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data);

        if (data.type === 'city') {
        this.liveCity = data.city;
        this.liveCompany = '';
        }

        if (data.type === 'company') {
        this.liveCompany = `${data.company} (${data.index}/${data.total})`;
        }

        if (data.type === 'done') {
        this.eventSource.close();
        this.allResults.push(...data.data);
        this.generateCSV(this.allResults);
        }

        if (data.type === 'error') {
        this.eventSource.close();
        console.error('Erreur scraping :', data.message);
        }
    };
    },
  }
};
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');

:root {
    --main-color: #262626;
    --second-color: #fbfbfb;
}
body {
    font-family: "Roboto", sans-serif;
    font-optical-sizing: auto;
}

h2 {
    font-weight: normal;
    font-size: 20px;
    margin-left: 15px;
}
button {
    padding: 12.5px 30px;
    background-color: var(--main-color);
    color: var(--second-color) !important;
    border-radius: 7.5px;
    border: solid 1px var(--main-color);
    font-size: 13.5px;

    margin-right: 15px;
    margin-left: 15px;
    cursor: pointer;
    transition: transform 0.2s ease;
}
button:hover {
  transform: translateY(-1px);
  transition: transform 0.2s ease;
}

.inputs, .buttons {
    margin-top: 25px;
}
input {
  padding: 12.5px 30px;
  border-radius: 7.5px;
  border: solid 1px var(--main-color);
  font-size: 13.5px;
  background-color: transparent;
  color: var(--main-color);
  outline: none;
  transition: border-color 0.2s ease;

  margin: 0px 15px;
}
input:focus {
  opacity: 0.7;
}

.continuer {
    margin-top: 25px;
}
</style>
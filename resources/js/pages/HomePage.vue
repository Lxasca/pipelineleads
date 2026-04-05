<template>
  <router-link :to="'/demo'">Demo</router-link>
  <div class="pipeline">

    <!-- ÉTAPE 1 -->
    <section v-if="currentStep === 1">
      <h2>Voulez-vous scraper...</h2>
      <div class="buttons">
        <button @click="pageMode = 'single'; pageMode && null" :class="{ active: pageMode === 'single' }">Une page</button>
        <button @click="pageMode = 'multiple'" :class="{ active: pageMode === 'multiple' }">Plusieurs pages</button>
      </div>

      <div v-if="pageMode === 'single'" class="inputs">
        <label>Numéro de la page</label>
        <input type="number" v-model="pageStart" min="1" />
      </div>

      <div v-if="pageMode === 'multiple'" class="inputs">
        <label>Page de début</label>
        <input type="number" v-model="pageStart" min="1" />
        <label>Page de fin</label>
        <input type="number" v-model="pageEnd" min="1" />
      </div>

      <button v-if="pageMode" class="continuer" @click="goToStep2()">Continuer →</button>
    </section>

    <!-- ÉTAPE 2 -->
    <section v-if="currentStep === 2">
      <h2>Depuis quelle ville veux-tu démarrer ?</h2>
      <p class="subtitle">{{ cities.length }} villes chargées</p>

      <div class="inputs">
        <label>Ville de départ (optionnel)</label>
        <input type="text" v-model="startCity" placeholder="Ex: Lyon" />
      </div>

      <div class="buttons">
        <button @click="startCity = ''; goToStep3()">Depuis le début</button>
        <button @click="goToStep3()" :disabled="!startCity">Depuis {{ startCity || '...' }}</button>
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
    }
  },
  methods: {
    async goToStep2() {
      if (!this.pageStart) return;
      if (this.pageMode === 'multiple' && !this.pageEnd) return;

      const pages = [];
      const end = this.pageMode === 'single' ? this.pageStart : this.pageEnd;
      for (let p = this.pageStart; p <= end; p++) {
        pages.push(p);
      }

      try {
        const allCities = [];
        for (const page of pages) {
          const res = await axios.post('/step1', { page });
          allCities.push(...res.data.data);
        }
        this.cities = allCities;
        this.currentStep = 2;
      } catch (err) {
        console.error('Erreur chargement villes :', err);
      }
    },

    goToStep3() {
      if (this.startCity) {
        const idx = this.cities.findIndex(c => c.toLowerCase() === this.startCity.toLowerCase());
        if (idx !== -1) {
          this.cities = this.cities.slice(idx);
        } else {
          alert(`Ville "${this.startCity}" non trouvée dans la liste.`);
          return;
        }
      }
      this.currentStep = 3;
      console.log('Villes à scraper :', this.cities);
    },

    step2() {
      axios.post('/step2', { niche: this.niche })
        .then((response) => {
          this.niche = response.data.data;
        })
        .catch((error) => {
          console.log('erreur : ', error);
        });
    },

    async step3() {
      const allResults = [];
      for (const city of this.cities) {
        try {
          const res = await axios.post("http://localhost:3001/scrape-maps", {
            cities: [city],
            niche: this.niche
          });
          const cityData = res.data.data[0];
          allResults.push(cityData);
          console.log(`✅ ${city} scrapée`);
        } catch (err) {
          console.error(`❌ Erreur sur ${city} :`, err.response?.data || err);
        }
      }

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
    }
  }
};
</script>
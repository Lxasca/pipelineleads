<template>
    <div>
        <h1>Pipeline</h1>

        <section id="step-1">
            <h2>Etape 1</h2>
            <p>
                Scraper les villes de France sur linternaute.com
            </p>

            <div>
                <form @submit.prevent="step1()">
                    <label for="page">Numéro de la page à scrapper</label>
                    <input type="number" v-model="formStep1.page" name="page" required>
                    <br>
                    <button>Lancer</button>
                </form>
            </div>

            <br>
            <div v-if="cities">
                <span v-for="(city, index) in cities">
                    <span v-if="index === cities.length - 1">et {{ city }}.</span>
                    <span v-else>{{ city }}, </span>
                </span>
            </div>
        </section>

        <section id="step-2">
            <h2>Etape 2</h2>
            <p>Identifier la niche</p>

            <div>
                <form @submit.prevent="step2()">
                    <label for="niche">Nom de la niche</label>
                    <input type="text" v-model="formStep2.niche" name="niche" required>
                    <br>
                    <button>Lancer</button>
                </form>
            </div>

            <br>
            <div v-if="niche">
                <p>Voulez-vous vraiment scrapper les {{ cities.length }} villes de la page {{ formStep1.page }} sur la niche {{ niche }} ?</p>
            </div>
        </section>

        <section>
            <button @click="step3()">Lancer le scrapping</button>
        </section>
    </div>
</template>

<script>
import axios from 'axios';
export default {
    name: "HomePage",
    data() {
        return {
            formStep1: {
                page: null,
            },
            cities: [],
            formStep2: {
                niche: ""
            },
            niche: ""
        }
    },
    methods: {
        step1() {
            axios.post('/step1', this.formStep1)
            .then((response) => {
                console.log('succès : ', response.data.data)
                this.cities = response.data.data
            })
            .catch((error) => {
                console.log('erreur : ', error)
            })
        },
        step2() {
            axios.post('/step2', this.formStep2)
            .then((response) => {
                console.log('succès : ', response.data)
                this.niche = response.data.data;
            })
            .catch((error) => {
                console.log('erreur : ', error)
            })
        },
        step3() {
            // on scrap dans Google Maps 🥶
        }
    }
};
</script>
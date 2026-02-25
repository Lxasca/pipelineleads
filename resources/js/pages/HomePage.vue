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
            }
        }
    },
    methods: {
        step1() {
            console.log('siiiii parti', this.formStep1)

            axios.post('/step1', this.formStep1)
            .then((response) => {
                console.log('succès : ', response.data)
            })
            .catch((error) => {
                console.log('erreur : ', error)
            })
        }
    }
};
</script>
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
                    <label for="number_first_city">Numéro de la première ville à scrapper</label>
                    <input type="number" v-model="formStep1.number_first_city" name="number_first_city" required>
                    <br>
                    <label for="counter_cities">Nombre de villes à scrapper</label>
                    <input type="number" v-model="formStep1.counter_cities" name="counter_cities" required="">
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
                number_first_city: null,
                counter_cities: null   
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
<template>
    <div>
        <h1>Pipeline</h1>

        <section id="step-1">
            <h2>Etape 1</h2>
            <p>
                Scraper les villes de France sur linternaute.com
            </p>

            <div>
                <form @submit="step1()">
                    <label for="from">Numéro de la première ville à scrapper</label>
                    <input type="number" name="from">

                    <label for="from">Nombre de villes à scrapper</label>
                    <input type="number" name="from">

                    <button>Lancer</button>
                </form>
            </div>
        </section>
    </div>
</template>

<script>
export default {
    name: "HomePage",
};
</script>
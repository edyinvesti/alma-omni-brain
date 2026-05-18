require('dotenv').config();
const { searchKnowledge } = require('./src/vector_search');

async function test() {
    console.log("🔍 Testando busca...\n");

    const results = await searchKnowledge("ecossistema sites sistemas Edy Carlos");

    console.log("Resultados:");
    results.forEach(r => {
        console.log(`\n📌 ${r.title} (score: ${r.score.toFixed(3)})`);
        console.log(`   ${r.content.substring(0, 150)}...`);
    });
}
test();
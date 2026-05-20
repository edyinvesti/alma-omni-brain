async function test() {
    try {
        const response = await fetch('http://localhost:3000/api/brain', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-alma-key': 'alma_secret_2026'
            },
            body: JSON.stringify({ prompt: 'Qual o seu nome?' })
        });
        const json = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(json, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}
test();

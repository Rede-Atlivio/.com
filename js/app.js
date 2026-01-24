// ... (mantenha suas configurações iniciais do Firebase lá no topo)

const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// EXPOSIÇÃO GLOBAL (O segredo para os testes funcionarem)
window.auth = auth;
window.db = db;
window.provider = provider;

export { db, auth, provider };

import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function init() {
    const container = document.getElementById('view-tutorials');
    if (!container) return;

    container.innerHTML = `
        <div class="flex justify-between items-center mb-6 animate-fade">
            <div>
                <h2 class="text-2xl font-black text-white uppercase italic tracking-tighter">🛠️ Tutoriais Admin</h2>
                <p class="text-xs text-blue-400 font-bold uppercase tracking-widest">Manual de Operação e Gestão Interna</p>
            </div>
            <button onclick="window.addTutorialAdmin()" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black shadow-lg flex items-center gap-2 text-xs uppercase transition active:scale-95">
                <i data-lucide="shield-check"></i> NOVO TUTORIAL INTERNO
            </button>
        </div>
        <div id="admin-tutorials-grid" class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <p class="text-gray-500 italic">Acessando cofre de instruções...</p>
        </div>
    `;
    
    // 🚀 FUNÇÃO DE POSTAGEM PRIVADA
    window.addTutorialAdmin = async () => {
        const title = prompt("Título do Tutorial Interno:");
        const url = prompt("Link do YouTube (Embed ou Watch):");
        if(!title || !url) return;
        
        let embedUrl = url;
        if(url.includes("watch?v=")) embedUrl = url.replace("watch?v=", "embed/").split("&")[0];
        if(url.includes("youtu.be/")) embedUrl = url.replace("youtu.be/", "www.youtube.com/embed/");
        if(url.includes("shorts/")) embedUrl = url.replace("shorts/", "embed/");

        try {
            // 🔐 SALVA NA COLEÇÃO PRIVADA
            await addDoc(collection(window.db, "admin_private_tutorials"), { 
                title, 
                url: embedUrl, 
                created_at: serverTimestamp() 
            });
            alert("✅ Tutorial salvo no cofre do Admin!");
            loadTutorialsAdmin();
        } catch (e) { alert("Erro ao salvar: " + e.message); }
    };

    window.deleteTutorialAdmin = async (id) => {
        if(confirm("Deseja excluir este tutorial de equipe?")) {
            await deleteDoc(doc(window.db, "admin_private_tutorials", id));
            loadTutorialsAdmin();
        }
    };

    loadTutorialsAdmin();
}

async function loadTutorialsAdmin() {
    const grid = document.getElementById('admin-tutorials-grid');
    const q = query(collection(window.db, "admin_private_tutorials"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    
    grid.innerHTML = "";
    if(snap.empty) { grid.innerHTML = `<p class="text-gray-500 py-10">Nenhum tutorial interno cadastrado.</p>`; return; }

    snap.forEach(d => {
        const data = d.data();
        grid.innerHTML += `
            <div class="bg-slate-900/80 border border-blue-500/10 rounded-3xl overflow-hidden shadow-2xl relative group hover:border-blue-500/40 transition-all duration-500">
                <div class="relative pt-[56.25%]">
                    <iframe class="absolute inset-0 w-full h-full pointer-events-none" src="${data.url}" frameborder="0"></iframe>
                </div>
                <div class="p-5 flex justify-between items-start bg-slate-900">
                    <div>
                        <span class="text-[9px] font-black text-blue-500 uppercase tracking-widest">Procedimento Interno</span>
                        <h3 class="font-black text-white text-sm leading-tight mt-1 uppercase italic">${data.title}</h3>
                    </div>
                    <button onclick="window.deleteTutorialAdmin('${d.id}')" class="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-xl transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

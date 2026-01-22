import { db, storage, auth } from '../app.js';
import { userProfile } from '../auth.js';
import { collection, query, where, getDocs, doc, getDoc, addDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let missaoAtualId = null;
let arquivoParaEnvio = null;
let currentLat = null, currentLng = null;

// CARREGAR MISSÕES (Atlas)
export async function carregarMissoes() {
    const container = document.getElementById('lista-missoes');
    if(!container) return;
    container.innerHTML = "";
    
    if(!userProfile) return;

    const q = query(collection(db, "missoes"), where("tenant_id", "==", userProfile.tenant_id), where("status", "==", "aberto"));
    const snap = await getDocs(q);
    
    if(snap.empty) { 
        container.innerHTML = `<div class="text-center py-12 text-gray-400"><p>Nenhuma missão disponível.</p></div>`; 
    } else {
        snap.forEach(d => {
            const m = d.data();
            let btnAction = userProfile.is_provider 
                ? `<button onclick="iniciarMissao('${d.id}')" class="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase italic shadow-md">📷 Capturar (R$ ${m.recompensa})</button>`
                : `<div class="w-full bg-gray-50 text-gray-400 py-3 rounded-xl font-bold text-[9px] text-center italic border border-gray-100">Área de Coletores</div>`;
            
            container.innerHTML += `<div class="bg-white p-5 rounded-2xl border-l-4 border-blue-900 shadow-sm mb-4"><div class="flex justify-between items-start mb-3"><h3 class="font-black text-blue-900 text-sm uppercase italic leading-tight max-w-[75%]">${m.titulo}</h3><span class="bg-green-100 text-green-700 px-2 py-1 rounded-md font-black text-[10px]">R$ ${m.recompensa}</span></div><p class="text-[10px] text-gray-500 mb-4">${m.descricao}</p>${btnAction}</div>`;
        });
    }
}

// INICIALIZAÇÃO
window.iniciarMissao = (id) => {
    missaoAtualId = id;
    document.getElementById('camera-input').click();
};

// PREVIEW E GPS
window.mostrarPreview = (input) => {
    if (input.files && input.files[0]) {
        arquivoParaEnvio = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('img-preview').src = e.target.result;
            document.getElementById('preview-modal').classList.remove('hidden');
            buscarGPS();
        }
        reader.readAsDataURL(arquivoParaEnvio);
        input.value = '';
    }
};

function buscarGPS() {
    const btn = document.getElementById('btn-confirmar-foto');
    const status = document.getElementById('gps-status');
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (p) => {
                currentLat = p.coords.latitude;
                currentLng = p.coords.longitude;
                status.innerText = `✅ GPS Fixado: ${p.coords.accuracy.toFixed(0)}m`;
                status.classList.replace('text-yellow-400', 'text-green-400');
                btn.innerText = "✅ ENVIAR PROVA";
                btn.disabled = false;
                btn.classList.replace('bg-gray-500', 'bg-green-500');
                btn.classList.remove('cursor-not-allowed', 'opacity-50');
            },
            (e) => { status.innerText = "⚠️ Erro no GPS."; },
            { enableHighAccuracy: true }
        );
    }
}

window.cancelarPreview = () => {
    document.getElementById('preview-modal').classList.add('hidden');
    arquivoParaEnvio = null;
};

// UPLOAD REAL
window.enviarFotoReal = async () => {
    document.getElementById('preview-modal').classList.add('hidden');
    document.getElementById('upload-overlay').classList.remove('hidden');
    
    try {
        if(!arquivoParaEnvio) throw new Error("Sem foto.");
        const timestamp = new Date().getTime();
        const refStorage = ref(storage, `provas/${userProfile.tenant_id}/${auth.currentUser.uid}/${timestamp}.jpg`);
        
        const snap = await uploadBytes(refStorage, arquivoParaEnvio);
        const url = await getDownloadURL(snap.ref);
        const docMissao = await getDoc(doc(db, "missoes", missaoAtualId));
        
        const assignmentRef = await addDoc(collection(db, "mission_assignments"), {
            mission_id: missaoAtualId,
            mission_title: docMissao.data().titulo,
            profile_id: auth.currentUser.uid,
            profile_email: auth.currentUser.email,
            photo_url: url,
            valor_bruto: parseFloat(docMissao.data().recompensa.replace(',', '.')),
            status: "submitted",
            submitted_at: serverTimestamp(),
            tenant_id: userProfile.tenant_id,
            gps_lat: currentLat, gps_lng: currentLng
        });

        // Cria Chat Vinculado
        await setDoc(doc(db, "chats", assignmentRef.id), {
            assignment_id: assignmentRef.id,
            mission_title: docMissao.data().titulo,
            participants: [auth.currentUser.uid, "ADMIN"], 
            last_message: "Prova enviada.",
            updated_at: serverTimestamp()
        });

        alert("✅ Missão Enviada!");
    } catch (e) { alert("Erro: " + e.message); } 
    finally { document.getElementById('upload-overlay').classList.add('hidden'); }
};

// Auto-Load
setInterval(() => { if(!document.getElementById('sec-missoes').classList.contains('hidden')) carregarMissoes(); }, 10000);

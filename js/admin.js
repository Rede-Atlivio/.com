import { db } from './app.js';
import { collection, query, where, onSnapshot, updateDoc, doc, increment, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// LÓGICA DO PAINEL DE APROVAÇÃO
export function carregarAdmin() {
    const container = document.getElementById('admin-pending-list');
    if(!container) return;

    const q = query(collection(db, "mission_assignments"), where("status", "==", "submitted"));
    onSnapshot(q, (snap) => {
        container.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            const gpsInfo = data.gps_lat ? `📍 ${data.gps_lat.toFixed(4)}, ${data.gps_lng.toFixed(4)}` : "⚠️ Sem GPS";
            container.innerHTML += `<div class="border border-gray-100 p-4 rounded-xl shadow-sm bg-gray-50 mb-2"><p class="font-bold text-xs text-blue-900">${data.mission_title}</p><p class="text-[9px] text-gray-500 mb-1">${data.profile_email}</p><p class="text-[9px] text-blue-600 font-bold mb-2">${gpsInfo}</p><a href="${data.photo_url}" target="_blank"><img src="${data.photo_url}" class="w-full h-32 object-cover rounded-lg mb-3"></a><div class="flex gap-2 mb-2"><button onclick="aprovarProva('${d.id}', '${data.profile_id}', ${data.valor_bruto})" class="flex-1 bg-green-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase">Aprovar</button><button onclick="rejeitarProva('${d.id}')" class="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded-lg text-[10px] font-bold uppercase">Rejeitar</button></div></div>`;
        });
    });
}

window.aprovarProva = async (docId, userId, valorBruto) => { 
    if(!confirm(`Aprovar e pagar?`)) return; 
    try { 
        await updateDoc(doc(db, "mission_assignments", docId), { status: "approved", approved_at: serverTimestamp() }); 
        await updateDoc(doc(db, "usuarios", userId), { saldo: increment(valorBruto) }); 
    } catch (e) { alert(e.message); } 
};

window.rejeitarProva = async (docId) => { 
    if(!confirm("Rejeitar?")) return; 
    await updateDoc(doc(db, "mission_assignments", docId), { status: "rejected" }); 
};

// SEEDS (TESTES)
window.rodarSeedOportunidade = async () => { await addDoc(collection(db, "oportunidades"), { titulo: "Bug: TV Samsung", descricao: "FastShop R$ 1000", tipo: "bug", created_at: serverTimestamp() }); };
window.rodarSeedMissao = async () => { await addDoc(collection(db, "missoes"), { titulo: "Gasolina Shell", descricao: "Foto do painel.", recompensa: "1,00", tenant_id: "atlivio_fsa_01", status: "aberto", created_at: serverTimestamp() }); };

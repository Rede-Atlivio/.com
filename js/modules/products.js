import { db } from '../app.js';
import { collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// LISTA DE PRODUTOS RECOMENDADOS (SIMULAÇÃO)
const produtosRecomendados = [
    { id: 1, nome: "Kit Ferramentas Pro", preco: 250.00, img: "https://m.media-amazon.com/images/I/71w6O0z-kGL._AC_SX679_.jpg", desc: "Ideal para montadores." },
    { id: 2, nome: "Parafusadeira 12V", preco: 199.90, img: "https://m.media-amazon.com/images/I/61KqM+y+QwL._AC_SX679_.jpg", desc: "Bateria longa duração." },
    { id: 3, nome: "Botas de Segurança", preco: 120.00, img: "https://m.media-amazon.com/images/I/61A6+3f+XJL._AC_UY575_.jpg", desc: "Conforto e proteção." },
    { id: 4, nome: "Mochila Impermeável", preco: 89.90, img: "https://m.media-amazon.com/images/I/71s+jB-GouL._AC_SX679_.jpg", desc: "Para entregadores." }
];

// INICIALIZAÇÃO
setTimeout(() => {
    carregarProdutos();
}, 1500); // Delay para não competir com serviços

function carregarProdutos() {
    const container = document.getElementById('sec-produtos');
    if(!container) return;

    container.innerHTML = `<h3 class="font-black text-xl text-blue-900 uppercase italic mb-4 px-2">Loja Parceira 🛒</h3>`;
    
    const grid = document.createElement('div');
    grid.className = "grid grid-cols-2 gap-3 px-2";

    produtosRecomendados.forEach(prod => {
        grid.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <img src="${prod.img}" class="w-full h-24 object-contain mb-2 rounded-lg bg-gray-50">
                <div>
                    <h4 class="font-bold text-xs text-gray-800 leading-tight mb-1">${prod.nome}</h4>
                    <p class="text-[10px] text-gray-500 mb-2">${prod.desc}</p>
                    <div class="flex justify-between items-center">
                        <span class="font-black text-green-600 text-sm">R$ ${prod.preco.toFixed(2)}</span>
                        <button onclick="alert('Redirecionando para compra...')" class="bg-blue-100 text-blue-700 p-1.5 rounded-lg text-[10px] font-bold uppercase">Ver</button>
                    </div>
                </div>
            </div>
        `;
    });

    container.appendChild(grid);
}

// FERRAMENTA ADMIN (SEED)
window.rodarSeedProdutos = async () => {
    if(!confirm("Criar produtos no banco?")) return;
    try {
        const batch = [];
        for(const p of produtosRecomendados) {
            await addDoc(collection(db, "produtos"), {
                ...p,
                created_at: serverTimestamp()
            });
        }
        alert("✅ Produtos criados!");
    } catch(e) {
        alert("Erro: " + e.message);
    }
};

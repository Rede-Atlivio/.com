import { db } from '../app.js';
import { collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// LISTA DE PRODUTOS (Imagens corrigidas e estáveis)
const produtosRecomendados = [
    { 
        id: 1, 
        nome: "Kit Ferramentas Pro", 
        preco: 250.00, 
        img: "https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?auto=format&fit=crop&w=300&q=80", 
        desc: "Ideal para montadores." 
    },
    { 
        id: 2, 
        nome: "Parafusadeira 12V", 
        preco: 199.90, 
        img: "https://images.unsplash.com/photo-1616400619175-5beda3a17896?auto=format&fit=crop&w=300&q=80", 
        desc: "Bateria longa duração." 
    },
    { 
        id: 3, 
        nome: "Botas de Segurança", 
        preco: 120.00, 
        img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=300&q=80", 
        desc: "Conforto e proteção." 
    },
    { 
        id: 4, 
        nome: "Mochila Impermeável", 
        preco: 89.90, 
        img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=300&q=80", 
        desc: "Para entregadores." 
    }
];

// INICIALIZAÇÃO
setTimeout(() => {
    carregarProdutos();
}, 1500);

function carregarProdutos() {
    const container = document.getElementById('sec-produtos');
    if(!container) return;

    // Garante que o container esteja limpo antes de renderizar
    container.innerHTML = "";
    
    const grid = document.createElement('div');
    grid.className = "grid grid-cols-2 gap-3 px-2";

    produtosRecomendados.forEach(prod => {
        grid.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div class="h-24 mb-2 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                    <img src="${prod.img}" class="w-full h-full object-cover" alt="${prod.nome}">
                </div>
                <div>
                    <h4 class="font-bold text-xs text-gray-800 leading-tight mb-1">${prod.nome}</h4>
                    <p class="text-[10px] text-gray-500 mb-2">${prod.desc}</p>
                    <div class="flex justify-between items-center">
                        <span class="font-black text-green-600 text-sm">R$ ${prod.preco.toFixed(2)}</span>
                        <button onclick="alert('Redirecionando para compra...')" class="bg-blue-100 text-blue-700 p-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-200 transition">Ver</button>
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

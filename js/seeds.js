import { db } from './app.js';
import { collection, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Função para popular o sistema com dados iniciais de teste
window.rodarSeedSistema = async () => {
    console.log("🚀 Iniciando Seed de Dados...");
    
    // Lista de Produtos Iniciais
    const produtos = [
        { nome: "Kit Ferramentas Pro", preco: 150.00, categoria: "Manutenção", imagem: "https://images.unsplash.com/photo-1581244276891-9977045ecaba?w=200" },
        { nome: "Uniforme Premium", preco: 89.90, categoria: "Vestuário", imagem: "https://images.unsplash.com/photo-1598501479155-90b4d4639e44?w=200" },
        { nome: "Bolsa Térmica Delivery", preco: 120.00, categoria: "Logística", imagem: "https://images.unsplash.com/photo-1585915461941-86088279867c?w=200" },
        { nome: "Luvas de Proteção G", preco: 25.00, categoria: "Segurança", imagem: "https://images.unsplash.com/photo-1590103513990-bc9320610996?w=200" },
        { nome: "Extensão Elétrica 10m", preco: 45.00, categoria: "Eletricista", imagem: "https://images.unsplash.com/photo-1558444479-c8f027d8a5db?w=200" }
    ];

    // Lista de Prestadores Fakes para o Radar
    const prestadores = [
        { uid: "fake_1", nome_profissional: "Carlos Silva (Teste)", services: [{category: "Barman", price: 120}], foto_perfil: "https://i.pravatar.cc/150?u=1" },
        { uid: "fake_2", nome_profissional: "Ana Oliveira (Teste)", services: [{category: "Limpeza", price: 80}], foto_perfil: "https://i.pravatar.cc/150?u=2" },
        { uid: "fake_3", nome_profissional: "Marcos Souza (Teste)", services: [{category: "Segurança", price: 200}], foto_perfil: "https://i.pravatar.cc/150?u=3" }
    ];

    try {
        // Inserir Produtos na Loja
        for (const p of produtos) {
            const ref = doc(collection(db, "produtos"));
            await setDoc(ref, { ...p, id: ref.id, criado_em: serverTimestamp() });
        }

        // Inserir Prestadores no Radar (Active Providers)
        for (const p of prestadores) {
            await setDoc(doc(db, "active_providers", p.uid), {
                ...p,
                is_online: true,
                last_seen: serverTimestamp()
            });
        }

        alert("✅ Sistema Populado! Verifique a Loja e o Radar de Serviços.");
    } catch (e) {
        console.error("Erro no Seed:", e);
        alert("Erro ao popular dados. Verifique o console.");
    }
};

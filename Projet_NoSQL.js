// ============================================================
// PROJET NoSQL - MongoDB
// ============================================================

// ============================================================
// PARTIE 1 - Mise à jour des utilisateurs
// ============================================================

// 1.1 - Ajouter une adresse à tous les utilisateurs
// updateMany({}) → met à jour tous les documents.
// $set → ajoute ou modifie un champ.
db.User.updateMany(
  {},
  {
    $set: {
      address: {
        street: "123 rue Exemple",
        city: "Paris",
        zip: "75001",
        country: "France"
      }
    }
  }
);

// ============================================================
// 1.2 - Simuler le membership (30% premium, 70% standard)
// Math.random() < 0.3 → 30% de chance d'obtenir "premium".
db.User.find({}, { _id: 1 }).forEach(user => {
  const membership = Math.random() < 0.3 ? "premium" : "standard";
  db.User.updateOne(
    { _id: user._id },
    { $set: { membership: membership } }
  );
});

// ============================================================
// 1.2 - Simuler l'historique de commandes
// $lookup : fait une jointure entre Carts et Products
// pour récupérer les informations des produits.
db.createCollection("orders");

db.Carts.aggregate([
  {
    $lookup: {
      from: "Products",
      localField: "items.productId",
      foreignField: "_id",
      as: "productDetails"
    }
  }
]).forEach(cart => {

  // Calcul du total
  let total = 0;
  cart.items.forEach(item => {
    const product = cart.productDetails.find(p =>
      p._id.toString() === item.productId.toString()
    );
    if (product) {
      total += product.price * item.quantity;
    }
  });

  // Génération d'une date aléatoire (3 derniers mois)
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);
  const randomDate = new Date(
    threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime())
  );

  // Insertion de la commande
  db.orders.insertOne({
    order_id: new ObjectId(),
    user_id: cart.userId,
    items: cart.items,
    total_amount: Math.round(total * 100) / 100,
    status: "processing",
    order_date: randomDate
  });
});

// ============================================================
// PARTIE 2 - Produits, Wishlists et Historique de navigation
// ============================================================

// 2.1 - Ajout de 7 nouveaux produits
db.Products.insertMany([
  {
    name: "Souris Gamer",
    description: "Souris RGB haute précision",
    price: 49.99,
    category: "Accessoires",
    stock: 80,
    images: [],
    createdAt: new Date()
  },
  {
    name: "Moniteur 24 pouces",
    description: "Écran Full HD IPS",
    price: 199.99,
    category: "Informatique",
    stock: 30,
    images: [],
    createdAt: new Date()
  },
  {
    name: "Chaise Gamer",
    description: "Chaise ergonomique avec support lombaire",
    price: 149.99,
    category: "Mobilier",
    stock: 20,
    images: [],
    createdAt: new Date()
  },
  {
    name: "SSD 1To",
    description: "Stockage rapide NVMe",
    price: 89.99,
    category: "Informatique",
    stock: 60,
    images: [],
    createdAt: new Date()
  },
  {
    name: "Webcam HD",
    description: "Caméra 1080p pour visioconférence",
    price: 39.99,
    category: "Accessoires",
    stock: 45,
    images: [],
    createdAt: new Date()
  },
  {
    name: "Haut-parleurs Bluetooth",
    description: "Son stéréo portable",
    price: 59.99,
    category: "Audio",
    stock: 70,
    images: [],
    createdAt: new Date()
  },
  {
    name: "Tablette 10 pouces",
    description: "Tablette légère et performante",
    price: 299.99,
    category: "Électronique",
    stock: 25,
    images: [],
    createdAt: new Date()
  }
]);

// ============================================================
// 2.1 - Créer les wishlists
// Récupère tous les produits et utilisateurs.
// Pour chaque utilisateur, choisit aléatoirement entre 5 et 10 produits.
// sort(() => Math.random() - 0.5) → mélange le tableau aléatoirement.
// slice(0, count) → prend N éléments.
const productIds = db.Products.find({}, { _id: 1 }).toArray().map(p => p._id);

db.User.find({}, { _id: 1 }).toArray().forEach(user => {
  const count = Math.floor(Math.random() * 6) + 5; // entre 5 et 10
  const shuffled = [...productIds].sort(() => Math.random() - 0.5);
  db.wishlists.insertOne({
    user_id: user._id,
    products: shuffled.slice(0, count)
  });
});

// ============================================================
// 2.2 - Historique de navigation (35 visites simulées)
// On récupère tous les utilisateurs de la collection User (leurs _id).
// On récupère tous les produits avec uniquement leur _id.
const users = db.User.find({}, { _id: 1 }).toArray();
const products = db.Products.find({}, { _id: 1 }).toArray();

for (let i = 0; i < 35; i++) {
  db.browsing_history.insertOne({
    user_id: users[Math.floor(Math.random() * users.length)]._id,
    product_id: products[Math.floor(Math.random() * products.length)]._id,
    viewed_at: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 60)
  });
}

// ============================================================
// PARTIE 3 - Requêtes d'agrégation
// ============================================================

// 3.1 - Chiffre d'affaires mensuel

// Actualiser le statut de chaque order
db.orders.updateMany(
  { status: "processing" },
  { $set: { status: "completed" } }
);

// Triage par mois et année
// $match   → filtre pour orders avec un status "completed"
// $project → extrait le mois et l'année de chaque commande
// $group   → regroupe par mois et additionne les montants
// $sort    → trie les résultats chronologiquement
db.orders.aggregate([
  { $match: { status: "completed" } },
  {
    $project: {
      month: { $month: "$order_date" },
      year: { $year: "$order_date" },
      total_amount: 1
    }
  },
  {
    $group: {
      _id: { year: "$year", month: "$month" },
      chiffre_affaires: { $sum: "$total_amount" }
    }
  },
  { $sort: { "_id.year": 1, "_id.month": 1 } }
]);

// ============================================================
// 3.2 - Produits souvent achetés ensemble
db.orders.aggregate([
  // 1. Décomposer le tableau items
  { $unwind: "$items" },

  // 2. Garder seulement _id de la commande et productId
  {
    $project: {
      _id: 1,
      productId: "$items.productId"
    }
  },

  // 3. Auto-jointure sur la même commande
  {
    $lookup: {
      from: "orders",
      localField: "_id",
      foreignField: "_id",
      as: "same_order"
    }
  },

  // 4. Décomposer les items de la même commande
  { $unwind: "$same_order" },
  { $unwind: "$same_order.items" },

  // 5. Créer les paires
  {
    $group: {
      _id: {
        product1: { $min: ["$productId", "$same_order.items.productId"] },
        product2: { $max: ["$productId", "$same_order.items.productId"] }
      },
      count: { $sum: 1 }
    }
  },

  // 6. Éliminer les paires identiques (A, A)
  {
    $match: {
      $expr: { $ne: ["$_id.product1", "$_id.product2"] }
    }
  },

  // 7. Trier et limiter
  { $sort: { count: -1 } },
  { $limit: 10 }
]);

// ============================================================
// PARTIE 4 - Index
// ============================================================

// 4.1 - Index composé sur reviews
// Optimise les requêtes filtrées par date et triées par note décroissante.
// rating: -1 en second → car c'est le champ de tri décroissant.
db.reviews.createIndex({ createdAt: 1, rating: -1 });

// Vérifier qu'il existe
db.reviews.getIndexes();

// ============================================================
// 4.2 - Index pour l'historique de navigation
db.browsing_history.createIndex(
  { user_id: 1, viewed_at: -1 },
  { name: "idx_browsing_userid_viewedat" }
);

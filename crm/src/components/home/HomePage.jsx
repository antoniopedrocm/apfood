import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  CreditCard,
  MessageCircle,
  Search,
  Star,
} from 'lucide-react';
import { CTA_VARIANT } from '../../config/featureFlags';
import { getCtaVariantColor, trackCtaClick } from '../../utils/ctaVariant';
import { db } from '../../firebaseConfig';
import { collection, collectionGroup, getDocs, limit, query, where } from 'firebase/firestore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { Input } from '../ui/Input';

/**
 * Firestore indexes recomendados para HomePage.jsx
 *
 * INDEX 1
 * collectionGroup: produtos
 * field: status
 * order: ASC
 *
 * INDEX 2 (se houver ordenação por data)
 * collectionGroup: produtos
 * field: status ASC
 * field: createdAt DESC
 *
 * INDEX 3 (se houver ordenação por popularidade)
 * collectionGroup: produtos
 * field: status ASC
 * field: pedidos DESC
 */

const copyOptions = [
  {
    title: 'Peça em poucos cliques, entrega rápida no seu bairro.',
    subtitle: 'Pagamento seguro, suporte no WhatsApp e avaliações reais de clientes próximos.',
    description:
      'Escolha a categoria, compare tempo e frete em segundos e finalize com confiança. Nossa vitrine reúne restaurantes e lojas locais com ofertas atualizadas para acelerar sua decisão.',
  },
  {
    title: 'Seu pedido favorito, do jeito mais simples.',
    subtitle: 'Acompanhe o preparo em tempo real e conte com atendimento humano quando precisar.',
    description:
      'Busque por prato, descubra promoções e encontre os mais bem avaliados sem rolar infinitamente. A experiência foi desenhada para reduzir o tempo até o primeiro clique.',
  },
  {
    title: 'Comida local com preço justo e entrega confiável.',
    subtitle: 'Parceiros da região, taxas transparentes e ofertas relevantes para o seu endereço.',
    description:
      'Valorizamos restaurantes locais e mostramos primeiro o que realmente entrega qualidade perto de você. Assim você escolhe melhor, economiza tempo e recebe mais rápido.',
  },
];

const quickCategories = ['Pizza', 'Hambúrguer', 'Japonês', 'Mercado', 'Sobremesa', 'Bebidas'];

const EMPTY_STATE_LABEL = 'Nenhum produto ativo disponível no momento';
const PRODUCT_PLACEHOLDER_IMAGE = '/images/product-placeholder.png';

const buildCatalogProduct = (docSnap, product = {}, storeNameById = new Map()) => {
  const storeId = product.lojaId || docSnap.ref.parent.parent?.id || '';

  return {
    id: docSnap.id,
    nome: product.nome || product.name || 'Produto',
    preco: product.preco,
    lojaId: storeId,
    lojaNome: storeNameById.get(storeId) || product.lojaNome || 'Loja',
    status: product.status,
    active: product.active,
    tempoEntrega: product.tempoEntrega,
    tempoEstimado: product.tempoEstimado,
    tempoPreparo: product.tempoPreparo,
    taxaEntrega: product.taxaEntrega,
    frete: product.frete,
    updatedAt: product.updatedAt,
    createdAt: product.createdAt,
    totalPedidos: product.totalPedidos,
    maisPedido: product.maisPedido,
    orderCount: product.orderCount,
    pedidosCount: product.pedidosCount,
    salesCount: product.salesCount,
    rating: product.rating,
    avaliacao: product.avaliacao,
    nota: product.nota,
    promocao: product.promocao,
    promo: product.promo,
    isPromotion: product.isPromotion,
    freteGratis: product.freteGratis,
    cupom: product.cupom,
    cupomCodigo: product.cupomCodigo,
    descontoPercentual: product.descontoPercentual,
    desconto: product.desconto,
    publicPath: product.publicPath,
    cardapioPath: product.cardapioPath,
    imageUrl:
      product.imageUrl ||
      product.image ||
      product.foto ||
      product.photoUrl ||
      product.thumbnail ||
      PRODUCT_PLACEHOLDER_IMAGE,
  };
};

const queryActiveProducts = async (field, value) => {
  const produtosRef = collectionGroup(db, 'produtos');
  const q = query(produtosRef, where(field, '==', value), limit(50));
  return getDocs(q);
};

const isMissingIndexError = (err) => {
  const errorMessage = String(err?.message || '').toLowerCase();
  return (
    err?.code === 'failed-precondition' ||
    errorMessage.includes('requires an index') ||
    errorMessage.includes('collection_group_asc index')
  );
};

const resolveStoreName = (store = {}, fallbackId = '') => {
  return (
    store.nome ||
    store.name ||
    store.razaoSocial ||
    store.fantasia ||
    fallbackId ||
    'Loja'
  );
};

const mergeAndNormalizeProducts = (products = []) => {
  const uniqueProducts = new Map();

  products.forEach((product) => {
    if (!product?.id || !isProductActive(product)) return;
    uniqueProducts.set(product.id, product);
  });

  return Array.from(uniqueProducts.values())
    .sort((a, b) => resolveDateValue(b.updatedAt) - resolveDateValue(a.updatedAt))
    .slice(0, 50);
};

const fetchActiveProductsCatalogFallback = async () => {
  const storesSnapshot = await getDocs(collection(db, 'lojas'));
  const storeNameById = new Map();

  storesSnapshot.docs.forEach((storeDoc) => {
    storeNameById.set(storeDoc.id, resolveStoreName(storeDoc.data() || {}, storeDoc.id));
  });

  const productSnapshots = await Promise.all(
    storesSnapshot.docs.map((storeDoc) => getDocs(collection(db, 'lojas', storeDoc.id, 'produtos')))
  );

  const mergedProducts = productSnapshots.flatMap((snapshot) =>
    snapshot.docs.map((docSnap) => {
      const product = docSnap.data() || {};
      return buildCatalogProduct(docSnap, product, storeNameById);
    })
  );

  return mergeAndNormalizeProducts(mergedProducts);
};

const fetchActiveProductsCatalog = async () => {
  try {
    // IMPORTANTE:
    // Essa consulta exige índice Firestore:
    // collectionGroup: produtos
    // field: status (Ascending)
    // Criar no console: Firestore → Indexes → Add Index
    const [statusSnapshot, activeSnapshot] = await Promise.all([
      queryActiveProducts('status', 'Ativo'),
      queryActiveProducts('active', true),
    ]);

    const mergedProducts = [...statusSnapshot.docs, ...activeSnapshot.docs].map((docSnap) => {
      const product = buildCatalogProduct(docSnap, docSnap.data() || {});
      return product;
    });

    return mergeAndNormalizeProducts(mergedProducts);
  } catch (err) {
    if (isMissingIndexError(err)) {
      console.warn("Firestore index missing, using fallback query");
      return fetchActiveProductsCatalogFallback();
    }

    throw err;
  }
};

const resolveDateValue = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const resolveNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = Number(value.replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : 0;
  }
  return 0;
};

const isProductActive = (product = {}) => {
  if (product.status === 'Ativo') return true;
  if (product.active === true) return true;
  return false;
};

const resolvePopularity = (item = {}) => {
  const popularityKeys = ['totalPedidos', 'maisPedido', 'orderCount', 'pedidosCount', 'salesCount'];
  return popularityKeys.reduce((acc, key) => {
    const value = resolveNumber(item[key]);
    return value > acc ? value : acc;
  }, 0);
};

const resolveRating = (item = {}) => {
  return resolveNumber(item.rating ?? item.avaliacao ?? item.nota);
};

const isPromotionalProduct = (item = {}) => {
  return Boolean(
    item.promocao ||
      item.promo ||
      item.isPromotion ||
      item.freteGratis ||
      item.cupom ||
      item.cupomCodigo ||
      resolveNumber(item.descontoPercentual) > 0 ||
      resolveNumber(item.desconto) > 0
  );
};

const getBadgeForSection = (sectionName, item) => {
  if (sectionName === 'Populares perto de você' && resolvePopularity(item) > 0) return 'Mais pedido';
  if (sectionName === 'Promoções / Frete grátis / Cupons') {
    if (item.cupomCodigo) return `Cupom ${item.cupomCodigo}`;
    if (item.freteGratis) return 'Frete grátis';
    if (isPromotionalProduct(item)) return 'Promoção';
  }
  if (sectionName === 'Bem avaliados' && resolveRating(item) > 0) return 'Bem avaliado';
  if (sectionName === 'Novos') return 'Novo';
  return '';
};

const formatCurrency = (value) => {
  const amount = resolveNumber(value);
  return amount <= 0 ? '—' : `R$ ${amount.toFixed(2).replace('.', ',')}`;
};

const sectionDefinitions = [
  {
    name: 'Populares perto de você',
    sortFn: (a, b) => {
      const popularityDiff = resolvePopularity(b) - resolvePopularity(a);
      if (popularityDiff !== 0) return popularityDiff;
      return resolveDateValue(b.updatedAt) - resolveDateValue(a.updatedAt);
    },
  },
  {
    name: 'Promoções / Frete grátis / Cupons',
    filterFn: (item) => isPromotionalProduct(item),
    sortFn: (a, b) => resolveDateValue(b.updatedAt) - resolveDateValue(a.updatedAt),
  },
  {
    name: 'Bem avaliados',
    sortFn: (a, b) => {
      const ratingDiff = resolveRating(b) - resolveRating(a);
      if (ratingDiff !== 0) return ratingDiff;
      return resolveDateValue(b.updatedAt) - resolveDateValue(a.updatedAt);
    },
  },
  {
    name: 'Novos',
    sortFn: (a, b) => resolveDateValue(b.createdAt) - resolveDateValue(a.createdAt),
  },
];

export const HomePage = () => {
  const ctaVariantColor = getCtaVariantColor();
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [allActiveProducts, setAllActiveProducts] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      setLoadingProducts(true);

      try {
        const activeProducts = await fetchActiveProductsCatalog();

        if (!isMounted) return;

        setAllActiveProducts(activeProducts);
      } catch (error) {
        console.error('Erro ao carregar produtos ativos da Home:', error);
        if (isMounted) setAllActiveProducts([]);
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    };

    loadProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  const sectionCards = useMemo(() => {
    return sectionDefinitions.map((section) => {
      const filtered = section.filterFn
        ? allActiveProducts.filter(section.filterFn)
        : [...allActiveProducts];

      const cards = filtered
        .sort(section.sortFn)
        .slice(0, 3)
        .map((item) => ({
          id: item.id,
          name: item.nome || item.name || 'Produto',
          rating: resolveRating(item),
          eta: item.tempoEntrega || item.tempoEstimado || item.tempoPreparo || '—',
          fee: formatCurrency(item.taxaEntrega ?? item.frete),
          tag: getBadgeForSection(section.name, item),
          price: formatCurrency(item.preco),
          storeName: item.lojaNome || 'Loja',
          href: item.publicPath || item.cardapioPath || null,
          imageUrl: item.imageUrl || item.image || item.foto || PRODUCT_PLACEHOLDER_IMAGE,
        }));

      return {
        name: section.name,
        cards,
      };
    });
  }, [allActiveProducts]);

  return (
    <main className="home-page">
      <section className="home-search-section container-shell" aria-label="Busca de restaurantes e pratos">
        <div className="home-search-wrap">
          <Search className="search-icon" size={18} aria-hidden="true" />
          <Input aria-label="Buscar pratos" placeholder="Buscar pratos, restaurantes, doces, …" />
        </div>
      </section>

      <section className="hero container-shell">
        <p className="eyebrow">Entrega local com curadoria</p>
        <h1>{copyOptions[0].title}</h1>
        <p className="hero-subtitle">{copyOptions[0].subtitle}</p>
        <p className="hero-description">{copyOptions[0].description}</p>
        <div className="hero-cta-row">
          <Button
            variant={ctaVariantColor}
            onClick={trackCtaClick}
            aria-label={`Pedir agora - variante ${CTA_VARIANT}`}
          >
            Pedir agora
          </Button>
          <Button variant="ghost">Explorar categorias</Button>
        </div>
        <div className="chip-row" role="list" aria-label="Categorias rápidas">
          {quickCategories.map((category) => (
            <Chip key={category} role="listitem" aria-label={`Categoria ${category}`}>
              {category}
            </Chip>
          ))}
        </div>
      </section>

      {sectionCards.map(({ name: sectionName, cards }) => (
        <section key={sectionName} className="container-shell section-spacing">
          <div className="section-title-row">
            <h2>{sectionName}</h2>
          </div>
          <div className="cards-grid">
            {!loadingProducts && cards.length === 0 && (
              <Card>
                <div className="card-meta">
                  <span>{EMPTY_STATE_LABEL}</span>
                </div>
              </Card>
            )}

            {cards.map((item) => (
              <Card key={`${sectionName}-${item.id || item.name}`}>
                <button
                  type="button"
                  onClick={() => item.href && window.open(item.href, '_self')}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition">
                    <img
                      src={item.imageUrl || PRODUCT_PLACEHOLDER_IMAGE}
                      alt={item.name}
                      className="w-16 h-16 md:w-24 md:h-24 object-cover rounded-lg"
                      loading="lazy"
                    />

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="card-top">
                        <h3 className="truncate">{item.name}</h3>
                        {item.tag ? <Badge>{item.tag}</Badge> : null}
                      </div>
                      <p className="text-sm text-gray-500 mb-1 truncate">{item.storeName}</p>
                      <p className="text-sm font-medium text-gray-700 mb-2">{item.price}</p>
                      <div className="card-meta">
                        {item.rating > 0 ? (
                          <span>
                            <Star size={14} aria-hidden="true" /> {item.rating.toFixed(1)}
                          </span>
                        ) : null}
                        <span>
                          <Clock3 size={14} aria-hidden="true" /> {item.eta}
                        </span>
                        <span>{item.fee}</span>
                      </div>
                    </div>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <section className="container-shell section-spacing trust-block">
        <h2>Confiança para pedir sem dúvidas</h2>
        <div className="trust-grid">
          <p>
            <CreditCard size={16} aria-hidden="true" /> Cartão, Pix e carteira digital com confirmação rápida.
          </p>
          <p>
            <MessageCircle size={16} aria-hidden="true" /> Suporte via WhatsApp e chat durante todo o pedido.
          </p>
          <p>
            Links úteis: <a href="#">Como funciona</a> · <a href="#">Trocas/Cancelamento</a> ·{' '}
            <a href="#">Termos/Privacidade</a>
          </p>
        </div>
      </section>

      <footer className="home-footer">
        <div className="container-shell footer-grid">
          <div>
            <strong>APFood Goiânia</strong>
            <p>Av. Comercial, 433 · Jardim Nova Esperança</p>
            <p>Seg-Sex 09:30-18:30 · Sáb 09:00-14:00</p>
          </div>
          <div>
            <strong>Redes e contato</strong>
            <p>Instagram · WhatsApp · Chat online</p>
          </div>
          <div>
            <strong>Copy pronta (3 opções)</strong>
            <ul className="copy-list">
              {copyOptions.map((copy) => (
                <li key={copy.title}>
                  <span>{copy.title}</span>
                  <small>{copy.subtitle}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </main>
  );
};

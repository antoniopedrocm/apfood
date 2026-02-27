import React from 'react';
import {
  Clock3,
  CreditCard,
  MapPin,
  MessageCircle,
  Search,
  ShoppingCart,
  Star,
  User,
} from 'lucide-react';
import { CTA_VARIANT } from '../../config/featureFlags';
import { getCtaVariantColor, trackCtaClick } from '../../utils/ctaVariant';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { Input } from '../ui/Input';

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

const sectionCards = {
  'Populares perto de você': [
    { name: 'Brasa Burger', rating: '4.8', eta: '25-35 min', fee: 'R$ 5,90', tag: 'Mais pedido' },
    { name: 'Sushi Nipo House', rating: '4.9', eta: '35-45 min', fee: 'Grátis', tag: 'Entrega rápida' },
    { name: 'Pizzaria da Praça', rating: '4.7', eta: '30-40 min', fee: 'R$ 3,99', tag: 'Top da região' },
  ],
  'Promoções / Frete grátis / Cupons': [
    { name: 'Combo Família + Cupom', rating: '4.8', eta: '30-40 min', fee: 'Grátis', tag: 'Cupom AQUI10' },
    { name: 'Doces da Vovó', rating: '4.9', eta: '20-30 min', fee: 'R$ 2,99', tag: 'Leve 3 pague 2' },
    { name: 'Mercado Express', rating: '4.6', eta: '18-28 min', fee: 'Grátis', tag: 'Frete grátis' },
  ],
  'Bem avaliados': [
    { name: 'Forno de Minas', rating: '4.9', eta: '22-32 min', fee: 'R$ 4,50', tag: 'Qualidade premium' },
    { name: 'Taco Del Sol', rating: '4.8', eta: '28-38 min', fee: 'R$ 5,50', tag: 'Atendimento nota 10' },
    { name: 'Salad Fresh', rating: '4.8', eta: '20-30 min', fee: 'R$ 3,90', tag: 'Saudável' },
  ],
  Categorias: quickCategories.map((category) => ({
    name: category,
    rating: '4.7+',
    eta: '20-45 min',
    fee: 'a partir de R$ 0,00',
    tag: 'Explorar',
  })),
  Novos: [
    { name: 'Padaria do Bairro', rating: '4.6', eta: '20-35 min', fee: 'R$ 4,99', tag: 'Novo por aqui' },
    { name: 'Poke Tropical', rating: '4.7', eta: '25-35 min', fee: 'R$ 3,99', tag: 'Lançamento' },
    { name: 'Casa do Açaí', rating: '4.8', eta: '15-25 min', fee: 'Grátis', tag: 'Novidade gelada' },
  ],
};

export const HomePage = () => {
  const ctaVariantColor = getCtaVariantColor();

  return (
    <main className="home-page">
      <header className="home-header">
        <div className="home-header__content container-shell">
          <div className="home-logo">APFood</div>
          <button className="header-link" type="button" aria-label="Selecionar localização">
            <MapPin size={16} aria-hidden="true" /> Entregar em: Setor Central, Goiânia
          </button>
          <div className="home-search-wrap">
            <Search className="search-icon" size={18} aria-hidden="true" />
            <Input aria-label="Buscar pratos" placeholder="Buscar pratos, restaurantes, doces, …" />
          </div>
          <button className="header-link" type="button" aria-label="Abrir conta">
            <User size={16} aria-hidden="true" /> Entrar
          </button>
          <button className="header-link" type="button" aria-label="Abrir carrinho">
            <ShoppingCart size={16} aria-hidden="true" /> Carrinho
          </button>
        </div>
      </header>

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

      {Object.entries(sectionCards).map(([sectionName, cards]) => (
        <section key={sectionName} className="container-shell section-spacing">
          <div className="section-title-row">
            <h2>{sectionName}</h2>
          </div>
          <div className="cards-grid">
            {cards.map((item) => (
              <Card key={`${sectionName}-${item.name}`}>
                <div className="card-top">
                  <h3>{item.name}</h3>
                  <Badge>{item.tag}</Badge>
                </div>
                <div className="card-meta">
                  <span>
                    <Star size={14} aria-hidden="true" /> {item.rating}
                  </span>
                  <span>
                    <Clock3 size={14} aria-hidden="true" /> {item.eta}
                  </span>
                  <span>{item.fee}</span>
                </div>
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

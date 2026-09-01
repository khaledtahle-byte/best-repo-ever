/**
 * The shop's catalogue, transcribed from the printed Abou Sobhi menu card.
 * Prices are whole Lebanese pounds exactly as printed. A blank column on the
 * card means that size simply is not sold — those variants are absent here
 * rather than priced at zero.
 */

export type VariantKind = 'sandwich' | 'platter' | 'baguette';

export interface SeedVariant {
  kind: VariantKind;
  price: number;
}

export interface SeedProduct {
  slug: string;
  nameAr: string;
  nameEn: string;
  descAr?: string;
  descEn?: string;
  addons?: string[];
  badge?: 'signature' | 'popular' | 'spicy';
  variants: SeedVariant[];
}

export interface SeedCategory {
  slug: string;
  nameAr: string;
  nameEn: string;
  products: SeedProduct[];
}

const SHAWARMA_ADDONS = ['cheese', 'nuts', 'double'];
const PIZZA_ADDONS = ['cheese', 'double'];

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    slug: 'chicken',
    nameAr: 'شاورما دجاج',
    nameEn: 'Chicken Shawarma',
    products: [
      {
        slug: 'shawarma-chicken-lebanese',
        nameAr: 'شاورما دجاج خبز عادي',
        nameEn: 'Shawarma Chicken',
        descAr: 'خبز لبناني عادي',
        descEn: 'Lebanese bread',
        badge: 'popular',
        addons: SHAWARMA_ADDONS,
        variants: [
          { kind: 'sandwich', price: 600_000 },
          { kind: 'platter', price: 1_200_000 },
        ],
      },
      {
        slug: 'shawarma-chicken-markouk',
        nameAr: 'شاورما دجاج خبز مرقوق',
        nameEn: 'Shawarma Chicken',
        descAr: 'خبز مرقوق',
        descEn: 'Markouk bread',
        addons: SHAWARMA_ADDONS,
        variants: [
          { kind: 'sandwich', price: 600_000 },
          { kind: 'platter', price: 1_200_000 },
        ],
      },
      {
        slug: 'shawarma-chicken-extra',
        nameAr: 'شاورما دجاج اكسترا',
        nameEn: 'Shawarma Chicken Extra',
        descAr: 'جبنة وفطر',
        descEn: 'Cheese, mushroom',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'sandwich', price: 700_000 }],
      },
      {
        slug: 'shawarma-chicken-abou-sobhi',
        nameAr: 'شاورما دجاج أبو صبحي',
        nameEn: 'Shawarma Chicken Abou Sobhi',
        descAr: 'جبنة، فطر، مكسرات',
        descEn: 'Cheese, mushroom and nuts',
        badge: 'signature',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'sandwich', price: 800_000 }],
      },
      {
        slug: 'shawarma-al-rayes',
        nameAr: 'شاورما الرئيس',
        nameEn: 'Shawarma Al-Rayes',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'sandwich', price: 600_000 }],
      },
    ],
  },
  {
    slug: 'meat',
    nameAr: 'شاورما لحمة',
    nameEn: 'Meat Shawarma',
    products: [
      {
        slug: 'shawarma-meat-lebanese',
        nameAr: 'شاورما لحمة خبز عادي',
        nameEn: 'Shawarma Meat',
        descAr: 'خبز لبناني عادي',
        descEn: 'Lebanese bread',
        badge: 'popular',
        addons: SHAWARMA_ADDONS,
        variants: [
          { kind: 'sandwich', price: 750_000 },
          { kind: 'platter', price: 1_500_000 },
        ],
      },
      {
        slug: 'shawarma-meat-markouk',
        nameAr: 'شاورما لحمة خبز مرقوق',
        nameEn: 'Shawarma Meat',
        descAr: 'خبز مرقوق',
        descEn: 'Markouk bread',
        addons: SHAWARMA_ADDONS,
        variants: [
          { kind: 'sandwich', price: 750_000 },
          { kind: 'platter', price: 1_500_000 },
        ],
      },
      {
        slug: 'shawarma-meat-extra',
        nameAr: 'شاورما لحمة اكسترا',
        nameEn: 'Shawarma Meat Extra',
        descAr: 'جبنة، فطر',
        descEn: 'Cheese, mushroom',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'sandwich', price: 900_000 }],
      },
      {
        slug: 'shawarma-meat-abou-sobhi',
        nameAr: 'شاورما لحمة أبو صبحي',
        nameEn: 'Shawarma Meat Abou Sobhi',
        descAr: 'جبنة، فطر، مكسرات',
        descEn: 'Cheese, mushroom and nuts',
        badge: 'signature',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'sandwich', price: 1_000_000 }],
      },
    ],
  },
  {
    slug: 'mix',
    nameAr: 'شاورما ميكس',
    nameEn: 'Mix Shawarma',
    products: [
      {
        slug: 'shawarma-mix',
        nameAr: 'شاورما ميكس',
        nameEn: 'Shawarma Mix',
        descAr: 'لحمة ودجاج',
        descEn: 'Chicken + meat',
        addons: SHAWARMA_ADDONS,
        variants: [
          { kind: 'sandwich', price: 700_000 },
          { kind: 'platter', price: 1_400_000 },
        ],
      },
    ],
  },
  {
    slug: 'chilli',
    nameAr: 'تشيلي باجيت',
    nameEn: 'Chilli Baguette',
    products: [
      {
        slug: 'chilli-shawarma-chicken',
        nameAr: 'تشيلي شاورما دجاج',
        nameEn: 'Chilli Shawarma Chicken',
        descAr: 'حر، بندورة، مايونيز، كبيس، خردل',
        descEn: 'Spicy, tomato, mayonnaise, pickles and mustard',
        badge: 'spicy',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'baguette', price: 650_000 }],
      },
      {
        slug: 'chilli-shawarma-meat',
        nameAr: 'تشيلي شاورما لحمة',
        nameEn: 'Chilli Shawarma Meat',
        descAr: 'حر، بندورة، مايونيز، كبيس، خردل',
        descEn: 'Spicy, tomato, mayonnaise, pickles and mustard',
        badge: 'spicy',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'baguette', price: 800_000 }],
      },
      {
        slug: 'chilli-mix',
        nameAr: 'تشيلي ميكس',
        nameEn: 'Chilli Mix',
        descAr: 'حر، بندورة، مايونيز، كبيس، خردل',
        descEn: 'Spicy, tomato, mayonnaise, pickles and mustard',
        badge: 'spicy',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'baguette', price: 700_000 }],
      },
    ],
  },
  {
    slug: 'turkish',
    nameAr: 'شاورما تركية',
    nameEn: 'Turkish Shawarma',
    products: [
      {
        slug: 'shawarma-turkey-chicken',
        nameAr: 'شاورما تركية دجاج',
        nameEn: 'Shawarma Turkey Chicken',
        descAr: 'بصل، ملفوف أحمر، بندورة و٢ صوص',
        descEn: 'Onion, tomato, red cabbage and 2 sauces',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'sandwich', price: 700_000 }],
      },
      {
        slug: 'shawarma-turkey-meat',
        nameAr: 'شاورما تركية لحمة',
        nameEn: 'Shawarma Turkey Meat',
        descAr: 'بصل، ملفوف أحمر، بندورة، بيواز و٢ صوص',
        descEn: 'Onion, tomato, red cabbage, biwaz and 2 sauces',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'sandwich', price: 850_000 }],
      },
      {
        slug: 'shawarma-turkey-mix',
        nameAr: 'شاورما تركية ميكس',
        nameEn: 'Shawarma Turkey Mix',
        addons: SHAWARMA_ADDONS,
        variants: [{ kind: 'sandwich', price: 800_000 }],
      },
    ],
  },
  {
    slug: 'pizza',
    nameAr: 'بيتزا شاورما',
    nameEn: 'Shawarma Pizza',
    products: [
      {
        slug: 'pizza-shawarma-chicken',
        nameAr: 'بيتزا شاورما دجاج',
        nameEn: 'Pizza Shawarma Chicken',
        descAr: 'جبنة، فطر، ثوم',
        descEn: 'Garlic, mushroom and cheese',
        addons: PIZZA_ADDONS,
        variants: [{ kind: 'platter', price: 1_600_000 }],
      },
      {
        slug: 'pizza-shawarma-meat',
        nameAr: 'بيتزا شاورما لحمة',
        nameEn: 'Pizza Shawarma Meat',
        descAr: 'جبنة، فطر، طحينة',
        descEn: 'Tahina, mushroom and cheese',
        addons: PIZZA_ADDONS,
        variants: [{ kind: 'platter', price: 1_900_000 }],
      },
      {
        slug: 'pizza-sausage',
        nameAr: 'بيتزا سجق',
        nameEn: 'Pizza Sausage',
        descAr: 'جبنة، فطر، ذرة، مايونيز',
        descEn: 'Mayonnaise, mushroom, corn, cheese',
        addons: PIZZA_ADDONS,
        variants: [{ kind: 'platter', price: 1_900_000 }],
      },
      {
        slug: 'pizza-mix',
        nameAr: 'بيتزا ميكس',
        nameEn: 'Pizza Mix',
        addons: PIZZA_ADDONS,
        variants: [{ kind: 'platter', price: 1_750_000 }],
      },
    ],
  },
];

export const SEED_ADDONS = [
  { slug: 'cheese', nameAr: 'إضافة جبنة', nameEn: 'Add cheese', price: 150_000 },
  { slug: 'nuts', nameAr: 'إضافة مكسرات', nameEn: 'Add nuts', price: 150_000 },
  { slug: 'double', nameAr: 'إضافة كمية دبل', nameEn: 'Add double quantity', price: 200_000 },
];

/** Tripoli neighbourhoods the shop actually delivers to, with realistic fees. */
export const SEED_ZONES = [
  { nameAr: 'التل', nameEn: 'El Tell', fee: 100_000 },
  { nameAr: 'الزاهرية', nameEn: 'Zahrieh', fee: 100_000 },
  { nameAr: 'المعرض', nameEn: 'Maarad', fee: 100_000 },
  { nameAr: 'أبو سمرا', nameEn: 'Abou Samra', fee: 150_000 },
  { nameAr: 'الضم والفرز', nameEn: 'Dam w Farez', fee: 150_000 },
  { nameAr: 'القبة', nameEn: 'Qobbe', fee: 150_000 },
  { nameAr: 'الميناء', nameEn: 'El Mina', fee: 200_000 },
  { nameAr: 'البداوي', nameEn: 'Beddawi', fee: 250_000 },
  { nameAr: 'القلمون', nameEn: 'Qalamoun', fee: 300_000 },
];

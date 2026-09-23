import { hash } from '@node-rs/argon2';
import {
  BusinessStatus,
  DayOfWeek,
  PriceTier,
  PrismaClient,
  ReviewStatus,
  Role,
} from '@prisma/client';

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface CitySeed {
  name: string;
  lat: number;
  lng: number;
  areas: string[];
}

interface ProvinceSeed {
  name: string;
  cities: CitySeed[];
}

const PROVINCES: ProvinceSeed[] = [
  {
    name: 'Punjab',
    cities: [
      {
        name: 'Lahore',
        lat: 31.5204,
        lng: 74.3587,
        areas: ['Gulberg', 'DHA Lahore', 'Johar Town', 'Model Town'],
      },
      {
        name: 'Faisalabad',
        lat: 31.4504,
        lng: 73.135,
        areas: ['Madina Town', 'D Ground'],
      },
      {
        name: 'Rawalpindi',
        lat: 33.5651,
        lng: 73.0169,
        areas: ['Saddar', 'Bahria Town Rawalpindi'],
      },
      {
        name: 'Multan',
        lat: 30.1575,
        lng: 71.5249,
        areas: ['Cantt', 'Gulgasht Colony'],
      },
      {
        name: 'Gujranwala',
        lat: 32.1877,
        lng: 74.1945,
        areas: ['Model Town Gujranwala'],
      },
    ],
  },
  {
    name: 'Sindh',
    cities: [
      {
        name: 'Karachi',
        lat: 24.8607,
        lng: 67.0011,
        areas: ['Clifton', 'DHA Karachi', 'Gulshan-e-Iqbal', 'Saddar Karachi'],
      },
      {
        name: 'Hyderabad',
        lat: 25.396,
        lng: 68.3578,
        areas: ['Latifabad', 'Qasimabad'],
      },
      {
        name: 'Sukkur',
        lat: 27.7052,
        lng: 68.8574,
        areas: ['Model Colony Sukkur'],
      },
    ],
  },
  {
    name: 'Khyber Pakhtunkhwa',
    cities: [
      {
        name: 'Peshawar',
        lat: 34.0151,
        lng: 71.5249,
        areas: ['University Town', 'Hayatabad'],
      },
      { name: 'Abbottabad', lat: 34.1463, lng: 73.2117, areas: ['Jinnahabad'] },
      {
        name: 'Mardan',
        lat: 34.1989,
        lng: 72.0404,
        areas: ['Bank Road Mardan'],
      },
    ],
  },
  {
    name: 'Balochistan',
    cities: [
      {
        name: 'Quetta',
        lat: 30.1798,
        lng: 66.975,
        areas: ['Jinnah Town', 'Cantt Quetta'],
      },
      {
        name: 'Gwadar',
        lat: 25.1216,
        lng: 62.3254,
        areas: ['Old Town Gwadar'],
      },
    ],
  },
  {
    name: 'Islamabad Capital Territory',
    cities: [
      {
        name: 'Islamabad',
        lat: 33.6844,
        lng: 73.0479,
        areas: ['F-6', 'F-7', 'Blue Area', 'DHA Islamabad'],
      },
    ],
  },
  {
    name: 'Azad Jammu & Kashmir',
    cities: [
      {
        name: 'Muzaffarabad',
        lat: 34.3709,
        lng: 73.4711,
        areas: ['Upper Chattar'],
      },
    ],
  },
  {
    name: 'Gilgit-Baltistan',
    cities: [{ name: 'Gilgit', lat: 35.9208, lng: 74.3144, areas: ['Jutial'] }],
  },
];

const CATEGORY_TREE: { name: string; icon: string; children: string[] }[] = [
  {
    name: 'Food & Dining',
    icon: 'utensils',
    children: [
      'Restaurants',
      'Cafes & Coffee',
      'Fast Food',
      'Bakeries & Sweets',
      'Street Food',
      'Catering',
    ],
  },
  {
    name: 'Health & Medical',
    icon: 'stethoscope',
    children: [
      'Hospitals',
      'Clinics',
      'Dentists',
      'Pharmacies',
      'Diagnostic Labs',
      'Physiotherapy',
    ],
  },
  {
    name: 'Beauty & Wellness',
    icon: 'scissors',
    children: [
      'Salons',
      'Spas',
      'Barbershops',
      'Gyms & Fitness',
      'Tattoo Studios',
    ],
  },
  {
    name: 'Home Services',
    icon: 'wrench',
    children: [
      'Electricians',
      'Plumbers',
      'AC Repair',
      'Cleaning Services',
      'Carpenters',
      'Painters',
    ],
  },
  {
    name: 'Automotive',
    icon: 'car',
    children: [
      'Car Workshops',
      'Car Wash',
      'Tyre Shops',
      'Car Dealers',
      'Bike Mechanics',
    ],
  },
  {
    name: 'Shopping & Retail',
    icon: 'shopping-bag',
    children: [
      'Clothing',
      'Electronics',
      'Grocery Stores',
      'Mobile Shops',
      'Furniture',
    ],
  },
  {
    name: 'Education',
    icon: 'graduation-cap',
    children: [
      'Schools',
      'Colleges & Universities',
      'Tuition Centers',
      'Language Academies',
      'Driving Schools',
    ],
  },
  {
    name: 'Professional Services',
    icon: 'briefcase',
    children: [
      'Lawyers',
      'Accountants',
      'Real Estate Agents',
      'IT Services',
      'Photographers',
    ],
  },
  {
    name: 'Travel & Hospitality',
    icon: 'hotel',
    children: [
      'Hotels & Guest Houses',
      'Travel Agents',
      'Car Rentals',
      'Wedding Halls',
    ],
  },
  {
    name: 'Entertainment & Events',
    icon: 'party-popper',
    children: [
      'Event Planners',
      'Cinemas',
      'Parks & Recreation',
      'Videographers',
    ],
  },
];

const FEATURES = [
  'Free WiFi',
  'Parking Available',
  'Home Delivery',
  'Card Payment Accepted',
  'Cash on Delivery',
  'Outdoor Seating',
  'Family Section',
  'Air Conditioned',
  'Wheelchair Accessible',
  'Open 24 Hours',
  'Takes Reservations',
  'Halal Certified',
];

async function seedCategories(): Promise<Map<string, string>> {
  const leafIdByName = new Map<string, string>();

  for (const [index, top] of CATEGORY_TREE.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: slugify(top.name) },
      update: {},
      create: {
        name: top.name,
        slug: slugify(top.name),
        icon: top.icon,
        order: index,
      },
    });

    for (const [childIndex, childName] of top.children.entries()) {
      const child = await prisma.category.upsert({
        where: { slug: slugify(childName) },
        update: {},
        create: {
          name: childName,
          slug: slugify(childName),
          parentId: parent.id,
          order: childIndex,
        },
      });
      leafIdByName.set(childName, child.id);
    }
  }

  return leafIdByName;
}

async function seedFeatures(): Promise<Map<string, string>> {
  const idByName = new Map<string, string>();
  for (const name of FEATURES) {
    const feature = await prisma.feature.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    idByName.set(name, feature.id);
  }
  return idByName;
}

interface CityRecord {
  id: string;
  provinceId: string;
}

async function seedGeography(): Promise<{
  cityByName: Map<string, CityRecord>;
  areaByKey: Map<string, string>;
}> {
  const cityByName = new Map<string, CityRecord>();
  const areaByKey = new Map<string, string>();

  for (const provinceSeed of PROVINCES) {
    const province = await prisma.province.upsert({
      where: { slug: slugify(provinceSeed.name) },
      update: {},
      create: { name: provinceSeed.name, slug: slugify(provinceSeed.name) },
    });

    for (const citySeed of provinceSeed.cities) {
      const city = await prisma.city.upsert({
        where: { slug: slugify(citySeed.name) },
        update: {},
        create: {
          name: citySeed.name,
          slug: slugify(citySeed.name),
          provinceId: province.id,
        },
      });
      await prisma.$executeRaw`
        UPDATE "City"
        SET "centroid" = ST_SetSRID(ST_MakePoint(${citySeed.lng}, ${citySeed.lat}), 4326)::geography
        WHERE "id" = ${city.id}
      `;
      cityByName.set(citySeed.name, { id: city.id, provinceId: province.id });

      for (const areaName of citySeed.areas) {
        const area = await prisma.area.upsert({
          where: { cityId_slug: { cityId: city.id, slug: slugify(areaName) } },
          update: {},
          create: { name: areaName, slug: slugify(areaName), cityId: city.id },
        });
        areaByKey.set(`${citySeed.name}:${areaName}`, area.id);
      }
    }
  }

  return { cityByName, areaByKey };
}

interface SeededUsers {
  admin: { id: string };
  owner: { id: string };
  customers: { id: string }[];
}

async function seedUsers(): Promise<SeededUsers> {
  const passwordHash = await hash('Password123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@buisnez.pk' },
    update: {},
    create: {
      email: 'admin@buisnez.pk',
      name: 'Buisnez Admin',
      passwordHash,
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@buisnez.pk' },
    update: {},
    create: {
      email: 'owner@buisnez.pk',
      name: 'Bilal Ahmed',
      phone: '+923001234567',
      passwordHash,
      role: Role.BUSINESS_OWNER,
      emailVerifiedAt: new Date(),
    },
  });

  const customerSeeds = [
    {
      email: 'customer@buisnez.pk',
      name: 'Ayesha Raza',
      phone: '+923011234567',
    },
    {
      email: 'customer2@buisnez.pk',
      name: 'Hamza Sheikh',
      phone: '+923021234567',
    },
    {
      email: 'customer3@buisnez.pk',
      name: 'Fatima Malik',
      phone: '+923031234567',
    },
    {
      email: 'customer4@buisnez.pk',
      name: 'Usman Tariq',
      phone: '+923041234567',
    },
    {
      email: 'customer5@buisnez.pk',
      name: 'Sana Iqbal',
      phone: '+923051234567',
    },
  ];

  const customers: { id: string }[] = [];
  for (const seed of customerSeeds) {
    const customer = await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        email: seed.email,
        name: seed.name,
        phone: seed.phone,
        passwordHash,
        role: Role.CUSTOMER,
        emailVerifiedAt: new Date(),
      },
    });
    customers.push(customer);
  }

  return { admin, owner, customers };
}

interface DemoBusinessSeed {
  name: string;
  categoryName: string;
  cityName: string;
  areaName: string;
  lat: number;
  lng: number;
  addressLine: string;
  phone: string;
  priceTier: PriceTier;
  description: string;
  features: string[];
  featured?: boolean;
  /** Applied to every day of the week; omit for the default 09:00-22:00 (14:30 open on Friday) pattern. */
  hoursOverride?: { opensAt: string; closesAt: string; isClosed: boolean };
}

const DEMO_BUSINESSES: DemoBusinessSeed[] = [
  {
    name: 'Karachi Biryani House',
    categoryName: 'Restaurants',
    cityName: 'Karachi',
    areaName: 'Clifton',
    lat: 24.8138,
    lng: 67.0299,
    addressLine: 'Block 5, Clifton, Karachi',
    phone: '+922135678901',
    priceTier: PriceTier.TWO,
    description:
      'Popular biryani and BBQ spot serving Karachi-style biryani since 2005.',
    features: [
      'Home Delivery',
      'Family Section',
      'Air Conditioned',
      'Cash on Delivery',
    ],
  },
  {
    name: 'Round The Clock Pharmacy',
    categoryName: 'Pharmacies',
    cityName: 'Karachi',
    areaName: 'Gulshan-e-Iqbal',
    lat: 24.92,
    lng: 67.081,
    addressLine: 'Block 6, Gulshan-e-Iqbal, Karachi',
    phone: '+922134123456',
    priceTier: PriceTier.ONE,
    description:
      'Round-the-clock pharmacy stocking prescription and OTC medicines.',
    features: ['Open 24 Hours', 'Wheelchair Accessible'],
    hoursOverride: { opensAt: '00:00', closesAt: '23:59', isClosed: false },
  },
  {
    name: 'Grand Wedding Hall',
    categoryName: 'Wedding Halls',
    cityName: 'Lahore',
    areaName: 'Johar Town',
    lat: 31.4697,
    lng: 74.2728,
    addressLine: 'Main Boulevard, Johar Town, Lahore',
    phone: '+924237654321',
    priceTier: PriceTier.FOUR,
    description:
      'Large banquet hall for weddings and receptions, currently closed for renovation.',
    features: ['Parking Available'],
    hoursOverride: { opensAt: '00:00', closesAt: '00:00', isClosed: true },
  },
  {
    name: 'Lahore Fort Cafe',
    categoryName: 'Cafes & Coffee',
    cityName: 'Lahore',
    areaName: 'Gulberg',
    lat: 31.5497,
    lng: 74.3436,
    addressLine: 'MM Alam Road, Gulberg III, Lahore',
    phone: '+924235678901',
    priceTier: PriceTier.THREE,
    description: 'Cozy cafe with specialty coffee, pastries, and free WiFi.',
    features: [
      'Free WiFi',
      'Outdoor Seating',
      'Card Payment Accepted',
      'Takes Reservations',
    ],
    featured: true,
  },
  {
    name: 'Islamabad Smiles Dental Clinic',
    categoryName: 'Dentists',
    cityName: 'Islamabad',
    areaName: 'F-7',
    lat: 33.7195,
    lng: 73.0559,
    addressLine: 'F-7 Markaz, Islamabad',
    phone: '+925123456789',
    priceTier: PriceTier.THREE,
    description:
      'Modern dental clinic offering general and cosmetic dentistry.',
    features: [
      'Parking Available',
      'Air Conditioned',
      'Card Payment Accepted',
      'Wheelchair Accessible',
    ],
  },
  {
    name: 'Speedy Auto Workshop',
    categoryName: 'Car Workshops',
    cityName: 'Karachi',
    areaName: 'DHA Karachi',
    lat: 24.79,
    lng: 67.062,
    addressLine: 'Phase 6, DHA, Karachi',
    phone: '+922134567890',
    priceTier: PriceTier.ONE,
    description:
      'Full-service car workshop specializing in Japanese and European cars.',
    features: ['Parking Available', 'Open 24 Hours', 'Cash on Delivery'],
  },
  {
    name: 'Model Town Grocers',
    categoryName: 'Grocery Stores',
    cityName: 'Lahore',
    areaName: 'Model Town',
    lat: 31.4847,
    lng: 74.3253,
    addressLine: 'Main Boulevard, Model Town, Lahore',
    phone: '+924236789012',
    priceTier: PriceTier.ONE,
    description:
      'Neighborhood grocery store with fresh produce and daily essentials.',
    features: ['Home Delivery', 'Cash on Delivery', 'Parking Available'],
  },
  {
    name: 'Peshawar Heritage Restaurant',
    categoryName: 'Restaurants',
    cityName: 'Peshawar',
    areaName: 'Hayatabad',
    lat: 34.0044,
    lng: 71.5323,
    addressLine: 'Phase 2, Hayatabad, Peshawar',
    phone: '+299123456789',
    priceTier: PriceTier.TWO,
    description:
      'Traditional Peshawari cuisine including chapli kebab and namkeen gosht.',
    features: [
      'Family Section',
      'Halal Certified',
      'Parking Available',
      'Takes Reservations',
    ],
    featured: true,
  },
];

async function seedBusinesses(context: {
  categoryByName: Map<string, string>;
  featureByName: Map<string, string>;
  cityByName: Map<string, CityRecord>;
  areaByKey: Map<string, string>;
  owner: { id: string };
}): Promise<{ id: string; slug: string }[]> {
  const created: { id: string; slug: string }[] = [];

  for (const demo of DEMO_BUSINESSES) {
    const categoryId = context.categoryByName.get(demo.categoryName);
    const city = context.cityByName.get(demo.cityName);
    const areaId = context.areaByKey.get(`${demo.cityName}:${demo.areaName}`);
    if (!categoryId || !city || !areaId) {
      throw new Error(
        `Missing seed reference data for business "${demo.name}"`,
      );
    }

    const slug = slugify(demo.name);
    const business = await prisma.business.upsert({
      where: { slug },
      update: {
        description: demo.description,
        priceTier: demo.priceTier,
        featured: demo.featured ?? false,
      },
      create: {
        name: demo.name,
        slug,
        description: demo.description,
        ownerId: context.owner.id,
        categoryId,
        provinceId: city.provinceId,
        cityId: city.id,
        areaId,
        addressLine: demo.addressLine,
        phone: demo.phone,
        priceTier: demo.priceTier,
        status: BusinessStatus.PUBLISHED,
        isVerified: true,
        featured: demo.featured ?? false,
      },
    });

    await prisma.$executeRaw`
      UPDATE "Business"
      SET "location" = ST_SetSRID(ST_MakePoint(${demo.lng}, ${demo.lat}), 4326)::geography
      WHERE "id" = ${business.id}
    `;

    for (const day of Object.values(DayOfWeek)) {
      const hours = demo.hoursOverride ?? {
        opensAt: day === DayOfWeek.FRIDAY ? '14:30' : '09:00',
        closesAt: '22:00',
        isClosed: false,
      };
      await prisma.businessHours.upsert({
        where: {
          businessId_dayOfWeek: { businessId: business.id, dayOfWeek: day },
        },
        update: hours,
        create: { businessId: business.id, dayOfWeek: day, ...hours },
      });
    }

    for (const featureName of demo.features) {
      const featureId = context.featureByName.get(featureName);
      if (!featureId) {
        continue;
      }
      await prisma.businessFeature.upsert({
        where: { businessId_featureId: { businessId: business.id, featureId } },
        update: {},
        create: { businessId: business.id, featureId },
      });
    }

    created.push({ id: business.id, slug: business.slug });
  }

  return created;
}

/**
 * Deliberately varied review counts/ratings per business so search sorting, `minRating`, and the Bayesian
 * weighted rating (see docs/09-search-discovery.md) all have something meaningful to distinguish — e.g.
 * "lahore-fort-cafe" has a single 5-star review and must NOT outrank "karachi-biryani-house"'s 5 reviews
 * averaging 4.8 on the weighted-rating sort.
 */
const REVIEW_RATINGS: Record<string, number[]> = {
  'karachi-biryani-house': [5, 5, 4, 5, 5],
  'lahore-fort-cafe': [5],
  'islamabad-smiles-dental-clinic': [4, 4, 3],
  'speedy-auto-workshop': [5, 4, 4, 5],
  'model-town-grocers': [3, 2],
  'peshawar-heritage-restaurant': [5, 5, 5],
  'round-the-clock-pharmacy': [4],
  'grand-wedding-hall': [],
};

function commentFor(rating: number): { title: string; body: string } {
  if (rating >= 5) {
    return {
      title: 'Excellent service',
      body: 'Great experience, highly recommend this place.',
    };
  }
  if (rating === 4) {
    return {
      title: 'Good value',
      body: 'Solid choice for the price, will come back again.',
    };
  }
  if (rating === 3) {
    return {
      title: 'Decent, could improve',
      body: 'An okay experience overall, nothing special.',
    };
  }
  return {
    title: 'Not satisfied',
    body: 'Service did not meet expectations this time.',
  };
}

async function seedReviewsAndPhotos(
  businesses: { id: string; slug: string }[],
  customers: { id: string }[],
): Promise<void> {
  for (const business of businesses) {
    const ratings = REVIEW_RATINGS[business.slug] ?? [];
    let firstReviewId: string | null = null;

    for (const [index, rating] of ratings.entries()) {
      const reviewer = customers[index];
      if (!reviewer) {
        continue;
      }
      const comment = commentFor(rating);
      const review = await prisma.review.upsert({
        where: {
          businessId_userId: { businessId: business.id, userId: reviewer.id },
        },
        update: { rating, title: comment.title, body: comment.body },
        create: {
          businessId: business.id,
          userId: reviewer.id,
          rating,
          title: comment.title,
          body: comment.body,
          status: ReviewStatus.PUBLISHED,
        },
      });
      if (index === 0) {
        firstReviewId = review.id;
      }
    }

    const galleryOwner = customers[0];
    if (galleryOwner) {
      await prisma.photo.upsert({
        where: { id: `photo-${business.slug}-gallery` },
        update: {},
        create: {
          id: `photo-${business.slug}-gallery`,
          businessId: business.id,
          userId: galleryOwner.id,
          url: `https://picsum.photos/seed/${business.slug}-gallery/640/480`,
          caption: 'Business photo',
        },
      });
    }

    if (firstReviewId && galleryOwner) {
      await prisma.photo.upsert({
        where: { id: `photo-${business.slug}-review` },
        update: {},
        create: {
          id: `photo-${business.slug}-review`,
          businessId: business.id,
          reviewId: firstReviewId,
          userId: galleryOwner.id,
          url: `https://picsum.photos/seed/${business.slug}-review/640/480`,
          caption: 'Photo shared by a customer',
        },
      });
    }
  }
}

async function main(): Promise<void> {
  const categoryByName = await seedCategories();
  const featureByName = await seedFeatures();
  const { cityByName, areaByKey } = await seedGeography();
  const { admin, owner, customers } = await seedUsers();
  void admin;

  const businesses = await seedBusinesses({
    categoryByName,
    featureByName,
    cityByName,
    areaByKey,
    owner,
  });
  await seedReviewsAndPhotos(businesses, customers);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

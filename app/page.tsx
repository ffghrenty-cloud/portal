import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      {/* HERO — огромный заголовок */}
      <section className="bg-[#b6b5b3] py-32 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs uppercase tracking-[0.3em] mb-7">
            Мода, которая движется с тобой
          </p>
          <h1 className="text-[12rem] font-black leading-none tracking-tighter mb-8">
            ЛЁН
          </h1>
          <div className="flex gap-4">
            <Link
              href="/catalog"
              className="bg-black text-white px-8 py-4 text-xs uppercase tracking-widest hover:opacity-80 transition"
            >
              Смотреть каталог
            </Link>
            <Link
              href="/about"
              className="border border-black px-8 py-4 text-xs uppercase tracking-widest hover:bg-black hover:text-white transition"
            >
              О компании
            </Link>
          </div>
        </div>
      </section>

      {/* КАТЕГОРИИ — тёмный блок */}
      <section className="bg-black text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8">
            {[
              { title: 'Постельное бельё', href: '/catalog' },
              { title: 'Одежда', href: '/catalog' },
              { title: 'Аксессуары', href: '/catalog' },
            ].map((cat) => (
              <Link
                key={cat.title}
                href={cat.href}
                className="group border border-white/20 p-8 hover:border-white transition"
              >
                <div className="text-xl font-bold uppercase tracking-wider mb-2">
                  {cat.title}
                </div>
                <div className="text-xs uppercase tracking-widest opacity-60 group-hover:opacity-100 transition">
                  Смотреть →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ПРЕИМУЩЕСТВА */}
      <section className="bg-[#a99d91] py-16 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-4 gap-8 text-center">
            {[
              { title: 'Быстрая доставка', text: 'По всей Беларуси' },
              { title: 'Оптовые цены', text: 'От производителя' },
              { title: 'Гарантия качества', text: 'Собственное производство' },
              { title: 'Онлайн-заказы', text: 'Круглосуточно' },
            ].map((item) => (
              <div key={item.title}>
                <div className="text-xs uppercase tracking-widest font-bold mb-2">
                  {item.title}
                </div>
                <div className="text-xs text-gray-700">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#b6b5b3] py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-5xl font-black uppercase mb-6">
            Готовы начать?
          </h2>
          <p className="text-gray-100 mb-8">
            Зарегистрируйтесь как оптовый заказчик и получите доступ к персональным ценам.
          </p>
          <Link
            href="/register"
            className="inline-block bg-black text-white px-10 py-4 text-xs uppercase tracking-widest hover:opacity-80 transition"
          >
            Зарегистрироваться
          </Link>
        </div>
      </section>
    </div>
  );
}
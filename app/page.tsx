import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Оршанский льнокомбинат
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Оптовые поставки льняной продукции напрямую от производителя.
            Оформляйте заказы онлайн, отслеживайте статус, получайте документы.
          </p>
          <Link
            href="/catalog"
            className="bg-white text-blue-700 px-8 py-3 rounded font-semibold hover:bg-gray-100"
          >
            Перейти в каталог
          </Link>
        </div>
      </section>

      {/* Преимущества */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            Почему выбирают нас
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-3">Натуральный лён</h3>
              <p className="text-gray-600">
                100% льняная продукция собственного производства.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-3">Оптовые цены</h3>
              <p className="text-gray-600">
                Специальные условия для оптовых заказчиков.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-3">Онлайн-заказы</h3>
              <p className="text-gray-600">
                Оформляйте заказы и отслеживайте статус в личном кабинете.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Готовы начать работу?
          </h2>
          <p className="text-gray-600 mb-8">
            Зарегистрируйтесь как оптовый заказчик и получите доступ к персональным ценам.
          </p>
          <Link
            href="/register"
            className="bg-blue-600 text-white px-8 py-3 rounded font-semibold hover:bg-blue-700"
          >
            Зарегистрироваться
          </Link>
        </div>
      </section>
    </div>
  );
}
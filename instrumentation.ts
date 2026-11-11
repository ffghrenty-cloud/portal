/**
 * Инициализация схемы БД при запуске Node.js runtime.
 *
 * Создаёт отсутствующие таблицы и применяет добавочные миграции из lib/schema.ts.
 * Не добавляет тестовые товары и не удаляет существующие данные.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { initDatabase } = await import("./lib/schema");
  await initDatabase();
}

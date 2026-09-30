import { cookies } from "next/headers";
import path from "path";
import db from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; orderId: string }> }
) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  const userRole = cookieStore.get("userRole")?.value;
  const { type, orderId } = await params;

  if (!userId) {
    return new Response("Не авторизован", { status: 401 });
  }

  const isAdmin = userRole === "admin";

  // Проверка доступа: админ — любой заказ, клиент — только свой
  const order: any = await new Promise((resolve, reject) => {
    if (isAdmin) {
      db.get(
        "SELECT * FROM orders WHERE id = ?",
        [orderId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    } else {
      db.get(
        "SELECT * FROM orders WHERE id = ? AND user_id = ?",
        [orderId, userId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    }
  });

  if (!order) {
    return new Response("Заказ не найден", { status: 404 });
  }

  // Позиции заказа
  const items: any[] = await new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM order_items WHERE order_id = ?",
      [orderId],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });

  // Данные клиента, который сделал заказ
  const orderUser: any = await new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM users WHERE id = ?",
      [order.user_id],
      (err, row) => (err ? reject(err) : resolve(row))
    );
  });

  // Генерация PDF
  const PDFDocument = (await import("pdfkit")).default;

  // Пути к шрифтам с поддержкой кириллицы
  const fontRegularPath = path.join(
    process.cwd(),
    "fonts",
    "PTSans-Regular.ttf"
  );
  const fontBoldPath = path.join(process.cwd(), "fonts", "PTSans-Bold.ttf");

  const doc = new PDFDocument({ size: "A4", margin: 50 });

  // Регистрируем шрифты (иначе pdfkit не поймёт кириллицу)
  doc.registerFont("Main", fontRegularPath);
  doc.registerFont("Bold", fontBoldPath);
  doc.font("Main");

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    // Заголовок
    doc.font("Bold").fontSize(20).text("РУПТП «Оршанский льнокомбинат»", {
      align: "center",
    });
    doc.moveDown(0.3);
    doc
      .font("Main")
      .fontSize(10)
      .fillColor("#666")
      .text("Орша, Беларусь · +375 (216) 00-00-00", { align: "center" });
    doc.moveDown(1);

    // Тип документа
    const titles: Record<string, string> = {
      invoice: "Счёт на оплату",
      specification: "Спецификация заказа",
      contract: "Договор",
      shipping: "Отгрузочные документы",
    };

    doc
      .font("Bold")
      .fillColor("#000")
      .fontSize(16)
      .text(titles[type] || "Документ", { align: "center" });
    doc.moveDown(0.5);
    doc
      .font("Main")
      .fontSize(12)
      .text(`Заказ №${String(order.id).padStart(5, "0")}`, {
        align: "center",
      });
    doc
      .fontSize(10)
      .fillColor("#666")
      .text(
        `Дата: ${new Date(order.created_at).toLocaleDateString("ru-RU")}`,
        { align: "center" }
      );
    doc.moveDown(1.5);

    // Покупатель
    doc.font("Bold").fillColor("#000").fontSize(11).text("Покупатель:");
    doc.font("Main").fontSize(10).fillColor("#333");
    doc.text(`Компания: ${orderUser?.company || "—"}`);
    doc.text(`Email: ${orderUser?.email || "—"}`);
    doc.text(`Контакт: ${order.contact_name || "—"}`);
    doc.text(`Телефон: ${order.contact_phone || "—"}`);
    doc.text(`Адрес: ${order.address || "—"}`);
    doc.moveDown(1.5);

    // Таблица позиций
    doc.font("Bold").fillColor("#000").fontSize(11).text("Состав заказа:");
    doc.moveDown(0.5);

    const tableTop = doc.y;

    doc.font("Bold").fontSize(10).fillColor("#666");
    doc.text("Наименование", 50, tableTop);
    doc.text("Кол-во", 320, tableTop);
    doc.text("Цена", 380, tableTop);
    doc.text("Сумма", 470, tableTop);

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(545, tableTop + 15)
      .strokeColor("#ccc")
      .stroke();

    let y = tableTop + 25;
    doc.font("Main").fillColor("#000");

    for (const item of items) {
      doc.text(item.product_name || "—", 50, y, { width: 260 });
      doc.text(String(item.quantity), 320, y);
      doc.text(`${item.price.toFixed(2)} BYN`, 380, y);
      doc.text(`${(item.quantity * item.price).toFixed(2)} BYN`, 470, y);
      y += 20;
    }

    doc
      .moveTo(50, y + 5)
      .lineTo(545, y + 5)
      .strokeColor("#333")
      .stroke();

    // Итого
    doc.font("Bold").fontSize(12).fillColor("#000").text("ИТОГО:", 380, y + 15);
    doc.fontSize(14).text(`${order.total.toFixed(2)} BYN`, 460, y + 15);

    // Подпись
    doc.moveDown(4);
    doc
      .font("Main")
      .fontSize(9)
      .fillColor("#666")
      .text("Документ сформирован автоматически в оптовом портале.", {
        align: "center",
      });

    doc.end();
  });

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${type}-${orderId}.pdf"`,
    },
  });
}
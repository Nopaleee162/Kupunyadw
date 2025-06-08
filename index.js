const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@fizzxydev/baileys-pro");
const pino = require("pino");
const readline = require("readline");
const chalk = require("chalk");
const messageHandler = require("./roox");

async function connectToWhatsApp() {
    let retryCount = 0;
    const maxRetries = 3;

    console.log(chalk.yellow(`BOT START...`));

    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const roox = makeWASocket({
        logger: pino({ level: "fatal" }),
        auth: state,
        printQRInTerminal: false,
    });

    roox.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect && retryCount < maxRetries) {
                console.log(chalk.red(`❌ Koneksi terputus. Mencoba ulang (${retryCount + 1}/${maxRetries})...`));
                retryCount++;
                connectToWhatsApp();
            } else {
                console.log(chalk.red("❌ Gagal terhubung. Silakan coba lagi nanti."));
            }
        } else if (connection === "open") {
            retryCount = 0;
            console.log(chalk.green("✅ BOT BERHASIL TERHUBUNG!"));
            roox.newsletterFollow("120363418914182399@newsletter")
        }
    });

    roox.ev.on("creds.update", saveCreds);
    roox.ev.on("messages.upsert", async (m) => await messageHandler(roox, m));

    if (!roox.authState.creds?.registered) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(chalk.cyan("📌 MASUKKAN NOMOR WHATSAPP ANDA (contoh: 628xxxxxxx): "), async (nomor) => {
            rl.close();

            if (!nomor.startsWith("62") || nomor.length < 10) {
                console.log(chalk.red("❌ Nomor tidak valid. Harus diawali '62' dan minimal 10 digit."));
                process.exit(1);
            }

            console.log(chalk.cyan(`📲 Nomor yang dimasukkan: ${nomor}`));

            try {
                const code = await roox.requestPairingCode(nomor);
                console.log(chalk.bgGreen.black(`\n✅ PAIRING CODE: ${code}\n`));
                console.log(chalk.bgRed.white("⚠️ MASUKKAN PAIRING CODE DI WHATSAPP SEBELUM 30 DETIK ⚠️"));
            } catch (err) {
                console.error(chalk.bgRed.white("❌ Gagal mendapatkan pairing code:", err.message || err));
                process.exit(1);
            }
        });
    }
}

connectToWhatsApp();

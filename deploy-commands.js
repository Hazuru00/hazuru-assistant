/**
 * ============================================================================
 * DEPLOY COMMANDS - Registro de Comandos en Discord
 * ============================================================================
 *
 * Este script registra todos los slash commands del bot con la API de Discord.
 * DEBE ejecutarse cada vez que se agrega, modifica o elimina un comando.
 *
 * CÓMO EJECUTAR:
 *   node deploy-commands.js
 *
 * NOTAS:
 *   - Los comandos se registran como GUILD (específicos de un servidor)
 *   - Para registrar globalmente (todos los servidores), usar Routes.applicationCommands
 *   - Los comandos pueden tardar hasta 1 hora en aparecer globalmente
 *   - Los comandos de guild aparecen instantáneamente
 *
 * VARIABLES DE ENTORNO REQUERIDAS:
 *   - DISCORD_TOKEN: Token del bot
 *   - CLIENT_ID: ID de la aplicación (bot)
 *   - GUILD_ID: ID del servidor donde registrar los comandos
 * ============================================================================
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ============================================================================
// 1. CARGAR TODOS LOS COMANDOS
// ============================================================================

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  // toJSON() serializa el SlashCommandBuilder a JSON para la API de Discord
  commands.push(command.data.toJSON());
}

// ============================================================================
// 2. ENVIAR COMANDOS A DISCORD
// ============================================================================

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Registrando ${commands.length} comandos...`);

    // Registro GLOBAL: comandos disponibles en TODOS los servidores del bot
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('✅ Comandos registrados correctamente.');
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();

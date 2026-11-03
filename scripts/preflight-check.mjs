#!/usr/bin/env node
/**
 * scripts/preflight-check.mjs
 * Script de verificación pre-vuelo para despliegue en producción de Ventrina SaaS.
 * Valida variables críticas, migraciones, configuración de Cloudflare y artefactos.
 */

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
let issuesCount = 0;
let warningsCount = 0;

console.log('🚀 Iniciando Verificación Pre-Vuelo para Producción — Ventrina SaaS\n');

function pass(msg) {
    console.log(`  ✅ [PASS] ${msg}`);
}

function warn(msg, advice) {
    warningsCount++;
    console.log(`  ⚠️  [WARN] ${msg}`);
    if (advice) console.log(`     👉 ${advice}`);
}

function fail(msg, advice) {
    issuesCount++;
    console.log(`  ❌ [FAIL] ${msg}`);
    if (advice) console.log(`     👉 ${advice}`);
}

// 1. Verificar Node.js
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor >= 18) {
    pass(`Node.js versión v${process.versions.node} (>= v18 requerido)`);
} else {
    fail(`Node.js v${process.versions.node} no soportado. Se requiere Node >= v18.`);
}

// 2. Verificar Migraciones D1
const migrationsDir = path.join(rootDir, 'migrations');
if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    if (files.length === 0) {
        fail('No se encontraron archivos de migración en migrations/');
    } else {
        pass(`Detectadas ${files.length} migraciones SQL secuenciales.`);
        // Verificar numeración
        let lastNum = -1;
        let gapDetected = false;
        for (const file of files) {
            const match = file.match(/^(\d{4})_/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (lastNum !== -1 && num !== lastNum + 1) {
                    warn(`Salto en la secuencia de migraciones: de ${lastNum} a ${num} (${file})`);
                    gapDetected = true;
                }
                lastNum = num;
            }
        }
        if (!gapDetected) {
            pass('Secuencia de numeración de migraciones íntegra (0000 - ' + String(lastNum).padStart(4, '0') + ').');
        }
    }
} else {
    fail('El directorio migrations/ no existe.');
}

// 3. Verificar wrangler.jsonc
const wranglerPath = path.join(rootDir, 'wrangler.jsonc');
if (fs.existsSync(wranglerPath)) {
    const raw = fs.readFileSync(wranglerPath, 'utf-8');
    // Eliminar comentarios para parsear JSON simple
    const cleanJson = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    try {
        const config = JSON.parse(cleanJson);
        pass('wrangler.jsonc tiene sintaxis JSON válida.');

        // Verificar Bindings
        const d1 = config.d1_databases?.[0];
        if (d1?.database_id && d1.database_id.length > 20) {
            pass(`Binding D1 configurado: '${d1.database_name}' (ID: ${d1.database_id})`);
        } else {
            warn('D1 database_id parece ser un valor de prueba.', 'Asegúrate de ejecutar "wrangler d1 create ventrina-db" y colocar el ID real de Cloudflare.');
        }

        const kv = config.kv_namespaces?.[0];
        if (kv?.id && kv.id !== 'ventrina-kv-id') {
            pass(`Binding KV configurado: ID '${kv.id}'`);
        } else {
            warn('KV Namespace ID es un valor por defecto ("ventrina-kv-id").', 'Crea el namespace con "wrangler kv:namespace create KV" antes de desplegar.');
        }

        const r2 = config.r2_buckets?.[0];
        if (r2?.bucket_name) {
            pass(`Binding R2 configurado: Bucket '${r2.bucket_name}'`);
        } else {
            fail('No hay un bucket R2 definido en r2_buckets.');
        }
    } catch (e) {
        fail(`Error al parsear wrangler.jsonc: ${e.message}`);
    }
} else {
    fail('wrangler.jsonc no encontrado en la raíz.');
}

// 4. Verificar Variables de Entorno y Secretos
const envVars = process.env;
const superadminKey = envVars.SUPERADMIN_KEY;
if (superadminKey) {
    if (superadminKey.length >= 32) {
        pass(`SUPERADMIN_KEY configurada con entropía adecuada (${superadminKey.length} caracteres).`);
    } else {
        warn(`SUPERADMIN_KEY tiene solo ${superadminKey.length} caracteres.`, 'Se recomienda una clave criptográfica de al menos 32 a 64 caracteres.');
    }
} else {
    warn('SUPERADMIN_KEY no detectada en el entorno local.', 'En Cloudflare Pages, agrégala en Settings > Environment variables con "wrangler pages secret put SUPERADMIN_KEY".');
}

const resendKey = envVars.RESEND_API_KEY;
if (resendKey) {
    if (resendKey.startsWith('re_')) {
        pass('RESEND_API_KEY tiene formato de API key válida de Resend.');
    } else {
        warn('RESEND_API_KEY no empieza con el prefijo oficial "re_".');
    }
} else {
    warn('RESEND_API_KEY no configurada. Los correos se simularán en logs.', 'Configura una clave de https://resend.com para envío de emails en vivo.');
}

// 5. Verificar Páginas Legales y Compliance
const terminosPath = path.join(rootDir, 'src/pages/terminos.astro');
const privacidadPath = path.join(rootDir, 'src/pages/privacidad.astro');
if (fs.existsSync(terminosPath) && fs.existsSync(privacidadPath)) {
    pass('Páginas de cumplimiento legal presentes (/terminos y /privacidad).');
} else {
    fail('Faltan páginas legales requeridas (/terminos o /privacidad).');
}

// 6. Verificar Worker de Wildcard
const proxyWorker = path.join(rootDir, 'workers/subdomain-proxy.js');
if (fs.existsSync(proxyWorker)) {
    const content = fs.readFileSync(proxyWorker, 'utf-8');
    if (content.includes('vendly-20w.pages.dev')) {
        warn('subdomain-proxy.js contiene un dominio de prueba legado ("vendly-20w.pages.dev").', 'Actualiza workers/wrangler.toml o la variable PAGES_TARGET_HOST con tu dominio Pages real.');
    } else {
        pass('Worker proxy de subdominios configurado con variable de host dinámica.');
    }
}

// Resumen Final
console.log('\n-----------------------------------------------------------');
if (issuesCount === 0 && warningsCount === 0) {
    console.log('🎉 ¡EXCELENTE! Todas las verificaciones pre-vuelo pasaron limpiamente.');
    process.exit(0);
} else if (issuesCount === 0) {
    console.log(`⚠️  Pre-vuelo completado con ${warningsCount} advertencia(s) operativa(s). El código está listo para compilar y desplegar.`);
    process.exit(0);
} else {
    console.log(`❌ Se encontraron ${issuesCount} problema(s) crítico(s) y ${warningsCount} advertencia(s). Corrige los fallos antes de ir a producción.`);
    process.exit(1);
}


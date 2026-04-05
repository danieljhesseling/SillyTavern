// Plugin manager script.
// Usage:
// 1. node plugins.js update
// 2. node plugins.js install <plugin-git-url>
// More operations coming soon.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { default as git, CheckRepoActions } from 'simple-git';
import { createGitClient } from './src/git/client.js';
import { color } from './src/util.js';

const __dirname = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);
const pluginsPath = './plugins';
const gitBackend = process.env.SILLYTAVERN_GIT_BACKEND || 'auto';

const command = process.argv[2];

if (!command) {
    process.exit(1);
}

if (command === 'update') {
    updatePlugins();
}

if (command === 'install') {
    const pluginName = process.argv[3];
    installPlugin(pluginName);
}

async function updatePlugins() {
    const directories = fs.readdirSync(pluginsPath)
        .filter(file => !file.startsWith('.'))
        .filter(file => fs.statSync(path.join(pluginsPath, file)).isDirectory());


    for (const directory of directories) {
        try {
            const pluginPath = path.join(pluginsPath, directory);
            const pluginRepo = git(pluginPath);

            const isRepo = await pluginRepo.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
            if (!isRepo) {
                continue;
            }

            await pluginRepo.fetch();
            const commitHash = await pluginRepo.revparse(['HEAD']);
            const trackingBranch = await pluginRepo.revparse(['--abbrev-ref', '@{u}']);
            const log = await pluginRepo.log({
                from: commitHash,
                to: trackingBranch,
            });

            if (log.total === 0) {
                continue;
            }

            await pluginRepo.pull();
            const latestCommit = await pluginRepo.revparse(['HEAD']);
        } catch (error) {
            console.error(color.red(`Failed to update plugin ${directory}: ${error.message}`));
        }
    }

}

async function installPlugin(pluginName) {
    try {
        const pluginPath = path.join(pluginsPath, path.basename(pluginName, '.git'));

        if (fs.existsSync(pluginPath)) {
            return console.log(color.yellow(`Directory already exists at ${pluginPath}`));
        }

        await createGitClient({ backend: gitBackend }).clone(pluginName, pluginPath, { depth: 1 });
    } catch (error) {
        console.error(color.red(`Failed to install plugin ${pluginName}`), error);
    }
}

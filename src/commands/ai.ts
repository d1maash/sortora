import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

import { loadConfig, saveConfig, getAppPaths, getAIProviderConfig, validateAPIKey, type AIProviderType } from '../config.js';
import { listProviders, type ProviderManagerConfig } from '../ai/providers/index.js';
import { Analyzer } from '../core/analyzer.js';

export function registerAICommand(program: Command): void {
  program
    .command('ai')
    .description('Manage AI providers for classification')
    .argument('[action]', 'list, set, test, info')
    .argument('[provider]', 'Provider name for set action (openai, anthropic, gemini, ollama, local)')
    .action(async (action, provider) => {
      const config = loadConfig();
      const paths = getAppPaths();
      const aiConfig = getAIProviderConfig(config);

      if (!action || action === 'list') {
        console.log(chalk.bold('\n  Available AI Providers:\n'));

        const providers = listProviders();
        for (const p of providers) {
          const isActive = p.type === aiConfig.provider;
          const marker = isActive ? chalk.green('*') : chalk.dim('o');
          const name = isActive ? chalk.green(p.name) : p.name;
          console.log(`  ${marker} ${name}`);
          console.log(chalk.dim(`      ${p.description}`));

          // Show configuration status
          if (p.type === 'openai' && aiConfig.openai?.apiKey) {
            console.log(chalk.dim(`      API Key: ****${aiConfig.openai.apiKey.slice(-4)}`));
          }
          if (p.type === 'anthropic' && aiConfig.anthropic?.apiKey) {
            console.log(chalk.dim(`      API Key: ****${aiConfig.anthropic.apiKey.slice(-4)}`));
          }
          if (p.type === 'gemini' && aiConfig.gemini?.apiKey) {
            console.log(chalk.dim(`      API Key: ****${aiConfig.gemini.apiKey.slice(-4)}`));
          }
          if (p.type === 'ollama') {
            console.log(chalk.dim(`      URL: ${aiConfig.ollama?.baseUrl || 'http://localhost:11434'}`));
          }
          console.log();
        }

        console.log(chalk.dim('  Set provider: sortora ai set <provider>'));
        console.log(chalk.dim('  Test provider: sortora ai test\n'));
        return;
      }

      if (action === 'info') {
        console.log(chalk.bold('\n  Current AI Configuration:\n'));
        console.log(chalk.cyan(`  Provider: ${aiConfig.provider}`));

        if (aiConfig.provider === 'openai') {
          console.log(chalk.dim(`  Model: ${aiConfig.openai?.model || 'gpt-4o-mini'}`));
          console.log(chalk.dim(`  API Key: ${aiConfig.openai?.apiKey ? '****' + aiConfig.openai.apiKey.slice(-4) : 'not set'}`));
        } else if (aiConfig.provider === 'anthropic') {
          console.log(chalk.dim(`  Model: ${aiConfig.anthropic?.model || 'claude-3-haiku-20240307'}`));
          console.log(chalk.dim(`  API Key: ${aiConfig.anthropic?.apiKey ? '****' + aiConfig.anthropic.apiKey.slice(-4) : 'not set'}`));
        } else if (aiConfig.provider === 'gemini') {
          console.log(chalk.dim(`  Model: ${aiConfig.gemini?.model || 'gemini-1.5-flash'}`));
          console.log(chalk.dim(`  API Key: ${aiConfig.gemini?.apiKey ? '****' + aiConfig.gemini.apiKey.slice(-4) : 'not set'}`));
        } else if (aiConfig.provider === 'ollama') {
          console.log(chalk.dim(`  Model: ${aiConfig.ollama?.model || 'llama3.2'}`));
          console.log(chalk.dim(`  URL: ${aiConfig.ollama?.baseUrl || 'http://localhost:11434'}`));
        } else if (aiConfig.provider === 'local') {
          console.log(chalk.dim(`  Models directory: ${paths.modelsDir}`));
        }

        console.log(chalk.dim('\n  Environment variables:'));
        console.log(chalk.dim(`    SORTORA_AI_PROVIDER: ${process.env.SORTORA_AI_PROVIDER || '(not set)'}`));
        console.log(chalk.dim(`    OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'set' : '(not set)'}`));
        console.log(chalk.dim(`    ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : '(not set)'}`));
        console.log(chalk.dim(`    GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'set' : '(not set)'}`));
        console.log(chalk.dim(`    OLLAMA_HOST: ${process.env.OLLAMA_HOST || '(not set)'}\n`));
        return;
      }

      if (action === 'set') {
        if (!provider) {
          console.log(chalk.red('\n  Please specify a provider: openai, anthropic, gemini, ollama, local\n'));
          return;
        }

        const validProviders = ['local', 'openai', 'anthropic', 'gemini', 'ollama'];
        if (!validProviders.includes(provider)) {
          console.log(chalk.red(`\n  Unknown provider: ${provider}`));
          console.log(chalk.dim(`  Available: ${validProviders.join(', ')}\n`));
          return;
        }

        // #13: Validate API key format before saving
        if (provider === 'openai' && !aiConfig.openai?.apiKey) {
          const { apiKey } = await inquirer.prompt([{
            type: 'password',
            name: 'apiKey',
            message: 'Enter your OpenAI API key:',
            mask: '*',
          }]);

          const validation = validateAPIKey('openai', apiKey);
          if (!validation.valid) {
            console.log(chalk.yellow(`\n  Warning: ${validation.message}`));
            const { proceed } = await inquirer.prompt([{
              type: 'confirm',
              name: 'proceed',
              message: 'Save anyway?',
              default: false,
            }]);
            if (!proceed) return;
          }

          config.ai.openai.apiKey = apiKey;
        }

        if (provider === 'anthropic' && !aiConfig.anthropic?.apiKey) {
          const { apiKey } = await inquirer.prompt([{
            type: 'password',
            name: 'apiKey',
            message: 'Enter your Anthropic API key:',
            mask: '*',
          }]);

          const validation = validateAPIKey('anthropic', apiKey);
          if (!validation.valid) {
            console.log(chalk.yellow(`\n  Warning: ${validation.message}`));
            const { proceed } = await inquirer.prompt([{
              type: 'confirm',
              name: 'proceed',
              message: 'Save anyway?',
              default: false,
            }]);
            if (!proceed) return;
          }

          config.ai.anthropic.apiKey = apiKey;
        }

        if (provider === 'gemini' && !aiConfig.gemini?.apiKey) {
          const { apiKey } = await inquirer.prompt([{
            type: 'password',
            name: 'apiKey',
            message: 'Enter your Gemini API key:',
            mask: '*',
          }]);

          const validation = validateAPIKey('gemini', apiKey);
          if (!validation.valid) {
            console.log(chalk.yellow(`\n  Warning: ${validation.message}`));
            const { proceed } = await inquirer.prompt([{
              type: 'confirm',
              name: 'proceed',
              message: 'Save anyway?',
              default: false,
            }]);
            if (!proceed) return;
          }

          config.ai.gemini.apiKey = apiKey;
        }

        config.ai.provider = provider as AIProviderType;
        saveConfig(config);

        console.log(chalk.green(`\n  AI provider set to: ${provider}\n`));
        return;
      }

      if (action === 'test') {
        const spinner = ora('Testing AI provider...').start();

        try {
          const analyzer = new Analyzer(paths.modelsDir);

          const providerConfig: ProviderManagerConfig = {
            provider: aiConfig.provider,
            openai: aiConfig.openai,
            anthropic: aiConfig.anthropic,
            gemini: aiConfig.gemini,
            ollama: aiConfig.ollama,
            local: { modelsDir: paths.modelsDir },
          };

          await analyzer.enableAIWithProvider(providerConfig);
          spinner.succeed(`AI provider initialized: ${analyzer.getActiveProviderName()}`);

          // Test classification
          const testSpinner = ora('Testing classification...').start();
          const testResult = await analyzer.classifyWithAI({
            path: '/test/example-document.pdf',
            filename: 'quarterly-report-2024.pdf',
            extension: 'pdf',
            size: 1024,
            created: new Date(),
            modified: new Date(),
            accessed: new Date(),
            mimeType: 'application/pdf',
            category: 'document',
            textContent: 'Q4 2024 Financial Summary. Revenue increased by 15%.',
          });

          testSpinner.succeed(`Classification test passed`);
          console.log(chalk.dim(`  Category: ${testResult.category}`));
          console.log(chalk.dim(`  Confidence: ${Math.round(testResult.confidence * 100)}%\n`));
        } catch (error) {
          spinner.fail(`AI provider test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log(chalk.dim('\n  Tips:'));
          if (aiConfig.provider === 'openai') {
            console.log(chalk.dim('    - Make sure OPENAI_API_KEY is set or configure via "sortora ai set openai"'));
          } else if (aiConfig.provider === 'anthropic') {
            console.log(chalk.dim('    - Make sure ANTHROPIC_API_KEY is set or configure via "sortora ai set anthropic"'));
          } else if (aiConfig.provider === 'gemini') {
            console.log(chalk.dim('    - Make sure GEMINI_API_KEY is set or configure via "sortora ai set gemini"'));
          } else if (aiConfig.provider === 'ollama') {
            console.log(chalk.dim('    - Make sure Ollama is running: ollama serve'));
            console.log(chalk.dim('    - Pull a model: ollama pull llama3.2'));
          } else if (aiConfig.provider === 'local') {
            console.log(chalk.dim('    - Run "sortora setup" to download local models'));
          }
          console.log();
        }
        return;
      }

      console.log(chalk.yellow('\n  Unknown action. Use: list, set, test, info\n'));
    });
}

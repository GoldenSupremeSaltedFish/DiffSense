#!/usr/bin/env node

/**
 * DiffSense Golang代码分析器
 * 分析Go代码的函数、结构体、接口和依赖关系
 */

const path = require('path');
const fs = require('fs');
const glob = require('glob');
const { execFile } = require('child_process');

class GolangAnalyzer {
  constructor(targetDir, options = {}) {
    this.targetDir = path.resolve(targetDir);
    this.options = {
      includeVendor: false,
      filePattern: '**/*.go',
      exclude: ['vendor/**', '**/testdata/**', '**/*_test.go'],
      ...options
    };
  }

  async analyze() {
    console.error(`🔍 开始分析Go项目: ${this.targetDir}`);
    
    try {
      const result = {
        timestamp: new Date().toISOString(),
        targetDir: this.targetDir,
        language: 'golang',
        summary: {},
        modules: {},
        functions: {},
        types: {},
        callGraph: { nodes: [], edges: [] },
        files: []
      };

      // 1. 分析Go模块信息
      const moduleInfo = await this.analyzeGoModule();
      result.modules = moduleInfo;

      // 2. 分析Go代码文件
      const codeAnalysis = await this.analyzeGoCode();
      result.functions = codeAnalysis.functions;
      result.types = codeAnalysis.types;
      result.callGraph = codeAnalysis.callGraph;
      result.files = codeAnalysis.files;

      // 3. 生成摘要信息
      result.summary = this.generateSummary(result);

      return result;

    } catch (error) {
      console.error('❌ Go分析失败:', error.message);
      throw error;
    }
  }

  async analyzeGoModule() {
    console.error('📦 分析Go模块信息...');
    
    const moduleInfo = {
      moduleName: '',
      goVersion: '',
      dependencies: [],
      hasGoMod: false,
      hasGoSum: false
    };

    try {
      // 检查go.mod文件
      const goModPath = path.join(this.targetDir, 'go.mod');
      if (fs.existsSync(goModPath)) {
        moduleInfo.hasGoMod = true;
        const goModContent = fs.readFileSync(goModPath, 'utf-8');
        
        // 解析模块名
        const moduleMatch = goModContent.match(/^module\s+(.+)$/m);
        if (moduleMatch) {
          moduleInfo.moduleName = moduleMatch[1].trim();
        }

        // 解析Go版本
        const goVersionMatch = goModContent.match(/^go\s+(.+)$/m);
        if (goVersionMatch) {
          moduleInfo.goVersion = goVersionMatch[1].trim();
        }

        // 解析依赖
        const requireSection = goModContent.match(/require\s*\(([\s\S]*?)\)/);
        if (requireSection) {
          const deps = requireSection[1].split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('//'))
            .map(line => {
              const parts = line.split(/\s+/);
              return { module: parts[0], version: parts[1] || '' };
            });
          moduleInfo.dependencies = deps;
        }
      }

      // 检查go.sum文件
      const goSumPath = path.join(this.targetDir, 'go.sum');
      moduleInfo.hasGoSum = fs.existsSync(goSumPath);

      console.error(`📊 模块名: ${moduleInfo.moduleName || '未知'}`);
      console.error(`📊 Go版本: ${moduleInfo.goVersion || '未知'}`);
      console.error(`📊 依赖数量: ${moduleInfo.dependencies.length}`);

      return moduleInfo;

    } catch (error) {
      console.error('Go模块分析失败:', error.message);
      return moduleInfo;
    }
  }

  async analyzeGoCode() {
    console.error('🔬 分析Go代码结构...');
    
    const files = glob.sync(this.options.filePattern, {
      cwd: this.targetDir,
      ignore: this.options.exclude,
      absolute: true
    });

    console.error(`📄 找到 ${files.length} 个Go文件`);

    const functions = {};
    const types = {};
    const callGraphNodes = [];
    const callGraphEdges = [];
    const fileInfos = [];

    for (const filePath of files) {
      try {
        const fileInfo = await this.analyzeGoFile(filePath);
        fileInfos.push(fileInfo);

        // 收集函数信息
        if (fileInfo.functions && fileInfo.functions.length > 0) {
          functions[fileInfo.relativePath] = fileInfo.functions;

          // 为每个函数创建节点
          fileInfo.functions.forEach(func => {
            const nodeId = `${fileInfo.relativePath}:${func.name}`;
            callGraphNodes.push({
              data: {
                id: nodeId,
                label: func.name,
                signature: func.signature,
                file: fileInfo.relativePath,
                type: func.type || 'function',
                receiver: func.receiver || null
              }
            });

            // 创建调用关系边
            if (func.calls && func.calls.length > 0) {
              func.calls.forEach(calledFunc => {
                const targetId = `${fileInfo.relativePath}:${calledFunc}`;
                callGraphEdges.push({
                  data: {
                    id: `${nodeId}->${targetId}`,
                    source: nodeId,
                    target: targetId,
                    type: 'calls'
                  }
                });
              });
            }
          });
        }

        // 收集类型信息
        if (fileInfo.types && fileInfo.types.length > 0) {
          types[fileInfo.relativePath] = fileInfo.types;
        }

      } catch (error) {
        console.error(`分析文件失败 ${filePath}:`, error.message);
      }
    }

    return {
      functions,
      types,
      callGraph: { nodes: callGraphNodes, edges: callGraphEdges },
      files: fileInfos
    };
  }

  async analyzeGoFile(filePath) {
    const relativePath = path.relative(this.targetDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf-8');

    const fileInfo = {
      path: filePath,
      relativePath: relativePath,
      extension: '.go',
      size: content.length,
      lines: content.split('\n').length,
      packageName: '',
      imports: [],
      functions: [],
      types: [],
      methods: []
    };

    try {
      // 解析包名
      const packageMatch = content.match(/^package\s+(\w+)/m);
      if (packageMatch) {
        fileInfo.packageName = packageMatch[1];
      }

      // 解析导入
      this.parseImports(content, fileInfo);

      // 解析函数
      this.parseFunctions(content, fileInfo);

      // 解析类型定义
      this.parseTypes(content, fileInfo);

      // 解析方法
      this.parseMethods(content, fileInfo);

    } catch (error) {
      console.error(`解析Go文件失败 ${relativePath}:`, error.message);
    }

    return fileInfo;
  }

  parseImports(content, fileInfo) {
    // 单行导入
    const singleImports = content.match(/^import\s+"([^"]+)"/gm);
    if (singleImports) {
      singleImports.forEach(match => {
        const importMatch = match.match(/import\s+"([^"]+)"/);
        if (importMatch) {
          fileInfo.imports.push({
            path: importMatch[1],
            alias: null
          });
        }
      });
    }

    // 多行导入
    const multiImportMatch = content.match(/import\s*\(([\s\S]*?)\)/);
    if (multiImportMatch) {
      const imports = multiImportMatch[1].split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'))
        .forEach(line => {
          const importMatch = line.match(/(?:(\w+)\s+)?"([^"]+)"/);
          if (importMatch) {
            fileInfo.imports.push({
              path: importMatch[2],
              alias: importMatch[1] || null
            });
          }
        });
    }
  }

  parseFunctions(content, fileInfo) {
    // 匹配函数定义
    const funcRegex = /func\s+(\w+)\s*\([^)]*\)(?:\s*\([^)]*\))?\s*{/g;
    let match;

    while ((match = funcRegex.exec(content)) !== null) {
      const funcName = match[1];
      const fullMatch = match[0];
      
      // 提取完整签名
      const signature = fullMatch.replace(/\s*{$/, '');
      
      // 分析函数调用
      const funcBodyStart = match.index + match[0].length;
      const funcBody = this.extractFunctionBody(content, funcBodyStart);
      const calls = this.extractFunctionCalls(funcBody);

      fileInfo.functions.push({
        name: funcName,
        signature: signature,
        type: 'function',
        line: content.substring(0, match.index).split('\n').length,
        calls: calls,
        isExported: funcName[0] === funcName[0].toUpperCase()
      });
    }
  }

  parseMethods(content, fileInfo) {
    // 匹配方法定义 (带接收者)
    const methodRegex = /func\s*\(\s*(\w+)\s+\*?(\w+)\s*\)\s+(\w+)\s*\([^)]*\)(?:\s*\([^)]*\))?\s*{/g;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      const receiverName = match[1];
      const receiverType = match[2];
      const methodName = match[3];
      const fullMatch = match[0];
      
      // 提取完整签名
      const signature = fullMatch.replace(/\s*{$/, '');
      
      // 分析方法调用
      const methodBodyStart = match.index + match[0].length;
      const methodBody = this.extractFunctionBody(content, methodBodyStart);
      const calls = this.extractFunctionCalls(methodBody);

      fileInfo.methods.push({
        name: methodName,
        signature: signature,
        type: 'method',
        receiver: receiverType,
        receiverName: receiverName,
        line: content.substring(0, match.index).split('\n').length,
        calls: calls,
        isExported: methodName[0] === methodName[0].toUpperCase()
      });

      // 也添加到functions数组中
      fileInfo.functions.push({
        name: `${receiverType}.${methodName}`,
        signature: signature,
        type: 'method',
        receiver: receiverType,
        line: content.substring(0, match.index).split('\n').length,
        calls: calls,
        isExported: methodName[0] === methodName[0].toUpperCase()
      });
    }
  }

  parseTypes(content, fileInfo) {
    // 解析结构体
    const structRegex = /type\s+(\w+)\s+struct\s*{([\s\S]*?)}/g;
    let match;

    while ((match = structRegex.exec(content)) !== null) {
      const typeName = match[1];
      const structBody = match[2];
      
      // 解析字段
      const fields = structBody.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'))
        .map(line => {
          const fieldMatch = line.match(/(\w+)\s+(.+?)(?:\s+`[^`]*`)?$/);
          if (fieldMatch) {
            return {
              name: fieldMatch[1],
              type: fieldMatch[2].trim()
            };
          }
          return null;
        })
        .filter(field => field);

      fileInfo.types.push({
        name: typeName,
        kind: 'struct',
        fields: fields,
        line: content.substring(0, match.index).split('\n').length,
        isExported: typeName[0] === typeName[0].toUpperCase()
      });
    }

    // 解析接口
    const interfaceRegex = /type\s+(\w+)\s+interface\s*{([\s\S]*?)}/g;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const typeName = match[1];
      const interfaceBody = match[2];
      
      // 解析方法签名
      const methods = interfaceBody.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'))
        .map(line => {
          const methodMatch = line.match(/(\w+)\s*\([^)]*\)(?:\s*\([^)]*\))?/);
          if (methodMatch) {
            return {
              name: methodMatch[1],
              signature: line
            };
          }
          return null;
        })
        .filter(method => method);

      fileInfo.types.push({
        name: typeName,
        kind: 'interface',
        methods: methods,
        line: content.substring(0, match.index).split('\n').length,
        isExported: typeName[0] === typeName[0].toUpperCase()
      });
    }

    // 解析类型别名
    const typeAliasRegex = /type\s+(\w+)\s+=\s+(.+)/g;
    while ((match = typeAliasRegex.exec(content)) !== null) {
      const typeName = match[1];
      const aliasType = match[2].trim();

      fileInfo.types.push({
        name: typeName,
        kind: 'alias',
        aliasOf: aliasType,
        line: content.substring(0, match.index).split('\n').length,
        isExported: typeName[0] === typeName[0].toUpperCase()
      });
    }
  }

  extractFunctionBody(content, startIndex) {
    let braceCount = 1;
    let i = startIndex;
    
    while (i < content.length && braceCount > 0) {
      if (content[i] === '{') {
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
      }
      i++;
    }
    
    return content.substring(startIndex, i - 1);
  }

  extractFunctionCalls(functionBody) {
    const calls = [];
    
    // 简化的函数调用匹配
    const callRegex = /(\w+(?:\.\w+)*)\s*\(/g;
    let match;
    
    while ((match = callRegex.exec(functionBody)) !== null) {
      const funcCall = match[1];
      // 过滤掉关键字和控制结构
      if (!['if', 'for', 'switch', 'select', 'range', 'go', 'defer'].includes(funcCall)) {
        calls.push(funcCall);
      }
    }
    
    return [...new Set(calls)]; // 去重
  }

  generateSummary(result) {
    const fileCount = result.files.length;
    const functionCount = Object.values(result.functions).reduce((sum, funcs) => sum + funcs.length, 0);
    const typeCount = Object.values(result.types).reduce((sum, types) => sum + types.length, 0);

    return {
      totalFiles: fileCount,
      totalFunctions: functionCount,
      totalTypes: typeCount,
      totalDependencies: result.modules.dependencies.length,
      moduleName: result.modules.moduleName,
      goVersion: result.modules.goVersion,
      averageFunctionsPerFile: fileCount > 0 ? Math.round(functionCount / fileCount * 100) / 100 : 0,
      analysisDate: result.timestamp
    };
  }
}

// 命令行调用
async function main() {
  const targetDir = process.argv[2] || process.cwd();
  const outputFormat = process.argv[3] || 'json';

  try {
    const analyzer = new GolangAnalyzer(targetDir);
    const result = await analyzer.analyze();

    if (outputFormat === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('📊 Go代码分析完成!');
      console.log(`文件数: ${result.summary.totalFiles}`);
      console.log(`函数数: ${result.summary.totalFunctions}`);
      console.log(`类型数: ${result.summary.totalTypes}`);
      console.log(`模块名: ${result.summary.moduleName || '未知'}`);
    }

  } catch (error) {
    console.error('分析失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = GolangAnalyzer; 
#!/usr/bin/env node

/**
 * DiffSense Golang代码分析器 - 增强版
 * 支持测试覆盖检测、精确调用图分析、Go特性全面支持
 */

const path = require('path');
const fs = require('fs');
const glob = require('glob');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

class GolangAnalyzer {
  constructor(targetDir, options = {}) {
    this.targetDir = path.resolve(targetDir);
    this.options = {
      includeVendor: false,
      filePattern: '**/*.go',
      exclude: ['vendor/**', '**/testdata/**'],
      includeTests: true, // 新增：包含测试文件
      analyzeTestCoverage: true, // 新增：分析测试覆盖
      analyzeGoroutines: true, // 新增：分析goroutine
      analyzeChannels: true, // 新增：分析channel
      analyzeInterfaces: true, // 新增：深度接口分析
      maxDepth: 15, // 增加递归深度以支持微服务项目
      ...options
    };
    
    // 新增：测试覆盖分析器
    this.testCoverageAnalyzer = new GoTestCoverageAnalyzer();
    
    // 新增：调用图增强分析器
    this.callGraphAnalyzer = new GoCallGraphAnalyzer(targetDir);
    
    // 新增：Go特性分析器
    this.goFeaturesAnalyzer = new GoFeaturesAnalyzer();
  }

  async analyze() {
    console.error(`🔍 开始增强分析Go项目: ${this.targetDir}`);
    
    try {
      const result = {
        timestamp: new Date().toISOString(),
        targetDir: this.targetDir,
        language: 'golang',
        version: '2.0', // 标记为增强版本
        summary: {},
        modules: {},
        functions: {},
        types: {},
        callGraph: { nodes: [], edges: [] },
        testCoverage: {}, // 新增：测试覆盖信息
        goFeatures: {}, // 新增：Go特性分析
        files: []
      };

      // 1. 分析Go模块信息（增强版）
      const moduleInfo = await this.analyzeGoModuleEnhanced();
      result.modules = moduleInfo;

      // 2. 分析Go代码文件（包含测试文件）
      const codeAnalysis = await this.analyzeGoCodeEnhanced();
      result.functions = codeAnalysis.functions;
      result.types = codeAnalysis.types;
      result.callGraph = codeAnalysis.callGraph;
      result.files = codeAnalysis.files;

      // 3. 新增：测试覆盖分析
      if (this.options.analyzeTestCoverage) {
        const testCoverage = await this.testCoverageAnalyzer.analyze(result);
        result.testCoverage = testCoverage;
      }

      // 4. 新增：Go特性分析
      const goFeatures = await this.goFeaturesAnalyzer.analyze(result);
      result.goFeatures = goFeatures;

      // 5. 生成增强摘要信息
      result.summary = this.generateEnhancedSummary(result);

      return result;

    } catch (error) {
      console.error('❌ Go增强分析失败:', error.message);
      throw error;
    }
  }

  async analyzeGoModuleEnhanced() {
    console.error('📦 分析Go模块信息 (增强模式)...');
    
    const moduleInfo = {
      moduleName: '',
      goVersion: '',
      dependencies: [],
      hasGoMod: false,
      hasGoSum: false,
      hasWorkFile: false, // 新增：go.work文件支持
      workspaces: [], // 新增：工作区支持
      toolchain: '', // 新增：工具链信息
      buildConstraints: [] // 新增：构建约束
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

        // 新增：解析工具链
        const toolchainMatch = goModContent.match(/^toolchain\s+(.+)$/m);
        if (toolchainMatch) {
          moduleInfo.toolchain = toolchainMatch[1].trim();
        }

        // 解析依赖（增强版）
        const requireSection = goModContent.match(/require\s*\(([\s\S]*?)\)/);
        if (requireSection) {
          const deps = requireSection[1].split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('//'))
            .map(line => {
              const parts = line.split(/\s+/);
              const isIndirect = line.includes('// indirect');
              return { 
                module: parts[0], 
                version: parts[1] || '', 
                indirect: isIndirect,
                constraint: parts[2] || ''
              };
            });
          moduleInfo.dependencies = deps;
        }
      }

      // 新增：检查go.work文件
      const goWorkPath = path.join(this.targetDir, 'go.work');
      if (fs.existsSync(goWorkPath)) {
        moduleInfo.hasWorkFile = true;
        const goWorkContent = fs.readFileSync(goWorkPath, 'utf-8');
        
        const useMatches = goWorkContent.match(/use\s+\(([\s\S]*?)\)|use\s+(.+)/g);
        if (useMatches) {
          useMatches.forEach(useMatch => {
            if (useMatch.includes('(')) {
              const workspaces = useMatch.match(/use\s+\(([\s\S]*?)\)/)[1]
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('//'));
              moduleInfo.workspaces.push(...workspaces);
            } else {
              const workspace = useMatch.replace('use', '').trim();
              if (workspace) moduleInfo.workspaces.push(workspace);
            }
          });
        }
      }

      // 检查go.sum文件
      const goSumPath = path.join(this.targetDir, 'go.sum');
      moduleInfo.hasGoSum = fs.existsSync(goSumPath);

      console.error(`📊 模块名: ${moduleInfo.moduleName || '未知'}`);
      console.error(`📊 Go版本: ${moduleInfo.goVersion || '未知'}`);
      console.error(`📊 依赖数量: ${moduleInfo.dependencies.length}`);
      console.error(`📊 工作区: ${moduleInfo.workspaces.length > 0 ? moduleInfo.workspaces.join(', ') : '无'}`);

      return moduleInfo;

    } catch (error) {
      console.error('Go模块增强分析失败:', error.message);
      return moduleInfo;
    }
  }

  async analyzeGoCodeEnhanced() {
    console.error('🔬 分析Go代码结构 (增强模式)...');
    
    // 分别处理业务代码和测试代码
    const businessFiles = glob.sync(this.options.filePattern, {
      cwd: this.targetDir,
      ignore: [...this.options.exclude, '**/*_test.go'],
      absolute: true,
      maxDepth: this.options.maxDepth // 使用配置的深度
    });

    const testFiles = this.options.includeTests ? glob.sync('**/*_test.go', {
      cwd: this.targetDir,
      ignore: this.options.exclude,
      absolute: true,
      maxDepth: this.options.maxDepth // 使用配置的深度
    }) : [];

    console.error(`📄 找到 ${businessFiles.length} 个业务文件，${testFiles.length} 个测试文件`);

    const functions = {};
    const types = {};
    const fileInfos = [];

    // 分析业务文件
    for (const filePath of businessFiles) {
      try {
        const fileInfo = await this.analyzeGoFileEnhanced(filePath, 'business');
        fileInfos.push(fileInfo);

        if (fileInfo.functions && fileInfo.functions.length > 0) {
          functions[fileInfo.relativePath] = fileInfo.functions;
        }
        if (fileInfo.types && fileInfo.types.length > 0) {
          types[fileInfo.relativePath] = fileInfo.types;
        }
      } catch (error) {
        console.error(`分析业务文件失败 ${filePath}:`, error.message);
      }
    }

    // 分析测试文件
    for (const filePath of testFiles) {
      try {
        const fileInfo = await this.analyzeGoFileEnhanced(filePath, 'test');
        fileInfos.push(fileInfo);

        if (fileInfo.functions && fileInfo.functions.length > 0) {
          functions[fileInfo.relativePath] = fileInfo.functions;
        }
        if (fileInfo.types && fileInfo.types.length > 0) {
          types[fileInfo.relativePath] = fileInfo.types;
        }
      } catch (error) {
        console.error(`分析测试文件失败 ${filePath}:`, error.message);
      }
    }

    // 使用增强调用图分析器
    const callGraph = await this.callGraphAnalyzer.buildEnhancedCallGraph(fileInfos, functions);

    return {
      functions,
      types,
      callGraph,
      files: fileInfos
    };
  }

  async analyzeGoFileEnhanced(filePath, fileType = 'business') {
    const relativePath = path.relative(this.targetDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf-8');

    const fileInfo = {
      path: filePath,
      relativePath: relativePath,
      extension: '.go',
      size: content.length,
      lines: content.split('\n').length,
      fileType: fileType, // 新增：文件类型标识
      packageName: '',
      imports: [],
      functions: [],
      types: [],
      methods: [],
      testFunctions: [], // 新增：测试函数
      benchmarkFunctions: [], // 新增：基准测试函数
      exampleFunctions: [], // 新增：示例函数
      initFunctions: [], // 新增：init函数
      goroutines: [], // 新增：goroutine分析
      channels: [], // 新增：channel分析
      interfaces: [], // 新增：接口分析
      embeddedTypes: [], // 新增：嵌入类型
      buildConstraints: [] // 新增：构建约束
    };

    try {
      // 解析构建约束
      this.parseBuildConstraints(content, fileInfo);

      // 解析包名
      const packageMatch = content.match(/^package\s+(\w+)/m);
      if (packageMatch) {
        fileInfo.packageName = packageMatch[1];
      }

      // 解析导入（增强版）
      this.parseImportsEnhanced(content, fileInfo);

      // 解析函数（增强版）
      this.parseFunctionsEnhanced(content, fileInfo);

      // 解析类型定义（增强版）
      this.parseTypesEnhanced(content, fileInfo);

      // 解析方法（增强版）
      this.parseMethodsEnhanced(content, fileInfo);

      // 新增：解析测试函数
      if (fileType === 'test') {
        this.parseTestFunctions(content, fileInfo);
      }

      // 新增：解析init函数
      this.parseInitFunctions(content, fileInfo);

      // 新增：解析Go特性
      if (this.options.analyzeGoroutines) {
        this.parseGoroutines(content, fileInfo);
      }

      if (this.options.analyzeChannels) {
        this.parseChannels(content, fileInfo);
      }

      if (this.options.analyzeInterfaces) {
        this.parseInterfacesEnhanced(content, fileInfo);
      }

      // 新增：解析嵌入类型
      this.parseEmbeddedTypes(content, fileInfo);

    } catch (error) {
      console.error(`解析Go文件失败 ${relativePath}:`, error.message);
    }

    return fileInfo;
  }

  parseBuildConstraints(content, fileInfo) {
    // 解析构建约束标签
    const constraintRegex = /^\/\/\s*\+build\s+(.+)$/gm;
    let match;
    
    while ((match = constraintRegex.exec(content)) !== null) {
      fileInfo.buildConstraints.push({
        type: 'build',
        value: match[1].trim(),
        line: content.substring(0, match.index).split('\n').length
      });
    }

    // Go 1.17+ 风格的构建约束
    const goConstraintRegex = /^\/\/go:build\s+(.+)$/gm;
    while ((match = goConstraintRegex.exec(content)) !== null) {
      fileInfo.buildConstraints.push({
        type: 'go:build',
        value: match[1].trim(),
        line: content.substring(0, match.index).split('\n').length
      });
    }
  }

  parseImportsEnhanced(content, fileInfo) {
    // 单行导入
    const singleImports = content.match(/^import\s+"([^"]+)"/gm);
    if (singleImports) {
      singleImports.forEach(match => {
        const importMatch = match.match(/import\s+"([^"]+)"/);
        if (importMatch) {
          fileInfo.imports.push({
            path: importMatch[1],
            alias: null,
            type: 'single'
          });
        }
      });
    }

    // 多行导入（增强版）
    const multiImportMatch = content.match(/import\s*\(([\s\S]*?)\)/);
    if (multiImportMatch) {
      const imports = multiImportMatch[1].split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'))
        .forEach(line => {
          // 处理各种导入格式
          let importMatch = line.match(/^(\w+)\s+"([^"]+)"$/); // 别名导入
          if (importMatch) {
            fileInfo.imports.push({
              path: importMatch[2],
              alias: importMatch[1],
              type: 'aliased'
            });
            return;
          }

          importMatch = line.match(/^\.\s+"([^"]+)"$/); // 点导入
          if (importMatch) {
            fileInfo.imports.push({
              path: importMatch[1],
              alias: '.',
              type: 'dot'
            });
            return;
          }

          importMatch = line.match(/^_\s+"([^"]+)"$/); // 空导入
          if (importMatch) {
            fileInfo.imports.push({
              path: importMatch[1],
              alias: '_',
              type: 'blank'
            });
            return;
          }

          importMatch = line.match(/^"([^"]+)"$/); // 普通导入
          if (importMatch) {
            fileInfo.imports.push({
              path: importMatch[1],
              alias: null,
              type: 'normal'
            });
          }
        });
    }
  }

  parseFunctionsEnhanced(content, fileInfo) {
    // 增强的函数定义匹配，支持泛型
    const funcRegex = /func\s+(?:\[([^\]]+)\])?\s*(\w+)\s*\(([^)]*)\)(?:\s*\(([^)]*)\))?\s*{/g;
    let match;

    while ((match = funcRegex.exec(content)) !== null) {
      const generics = match[1]; // 泛型参数
      const funcName = match[2];
      const params = match[3];
      const returns = match[4];
      const fullMatch = match[0];
      
      // 提取完整签名
      const signature = fullMatch.replace(/\s*{$/, '');
      
      // 分析函数体
      const funcBodyStart = match.index + match[0].length;
      const funcBody = this.extractFunctionBody(content, funcBodyStart);
      const calls = this.extractFunctionCallsEnhanced(funcBody);
      
      // 分析参数和返回值
      const paramInfo = this.parseParameters(params);
      const returnInfo = this.parseReturnTypes(returns);

      const funcInfo = {
        name: funcName,
        signature: signature,
        type: 'function',
        line: content.substring(0, match.index).split('\n').length,
        calls: calls,
        isExported: funcName[0] === funcName[0].toUpperCase(),
        hasGenerics: !!generics,
        generics: generics || null,
        parameters: paramInfo,
        returns: returnInfo,
        complexity: this.calculateComplexity(funcBody),
        hasDefer: funcBody.includes('defer'),
        hasPanic: funcBody.includes('panic('),
        hasRecover: funcBody.includes('recover('),
        hasGoroutine: funcBody.includes('go '),
        usesChannels: this.detectChannelUsage(funcBody),
        usesInterfaces: this.detectInterfaceUsage(funcBody, params, returns)
      };

      fileInfo.functions.push(funcInfo);
    }
  }

  parseMethodsEnhanced(content, fileInfo) {
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
      const calls = this.extractFunctionCallsEnhanced(methodBody);

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

  parseTypesEnhanced(content, fileInfo) {
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
          const methodMatch = line.match(/(\w+)\s*\(([^)]*)\)(?:\s*\(([^)]*)\))?/);
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

  parseTestFunctions(content, fileInfo) {
    // 测试函数
    const testRegex = /func\s+(Test\w+)\s*\(\s*(\w+)\s+\*testing\.T\s*\)\s*{/g;
    let match;

    while ((match = testRegex.exec(content)) !== null) {
      const testName = match[1];
      const paramName = match[2];
      
      const funcBodyStart = match.index + match[0].length;
      const funcBody = this.extractFunctionBody(content, funcBodyStart);
      
      // 分析测试函数调用的业务函数
      const businessCalls = this.extractBusinessFunctionCalls(funcBody);
      
      fileInfo.testFunctions.push({
        name: testName,
        type: 'test',
        line: content.substring(0, match.index).split('\n').length,
        paramName: paramName,
        businessCalls: businessCalls,
        hasSubtests: funcBody.includes('.Run('),
        hasParallel: funcBody.includes('.Parallel()'),
        hasSkip: funcBody.includes('.Skip('),
        complexity: this.calculateComplexity(funcBody)
      });
    }

    // 基准测试函数
    const benchmarkRegex = /func\s+(Benchmark\w+)\s*\(\s*(\w+)\s+\*testing\.B\s*\)\s*{/g;
    while ((match = benchmarkRegex.exec(content)) !== null) {
      const benchName = match[1];
      const paramName = match[2];
      
      const funcBodyStart = match.index + match[0].length;
      const funcBody = this.extractFunctionBody(content, funcBodyStart);
      
      fileInfo.benchmarkFunctions.push({
        name: benchName,
        type: 'benchmark',
        line: content.substring(0, match.index).split('\n').length,
        paramName: paramName,
        businessCalls: this.extractBusinessFunctionCalls(funcBody),
        hasResetTimer: funcBody.includes('.ResetTimer()'),
        hasStopTimer: funcBody.includes('.StopTimer()'),
        complexity: this.calculateComplexity(funcBody)
      });
    }

    // 示例函数
    const exampleRegex = /func\s+(Example\w*)\s*\(\s*\)\s*{/g;
    while ((match = exampleRegex.exec(content)) !== null) {
      const exampleName = match[1];
      
      const funcBodyStart = match.index + match[0].length;
      const funcBody = this.extractFunctionBody(content, funcBodyStart);
      
      fileInfo.exampleFunctions.push({
        name: exampleName,
        type: 'example',
        line: content.substring(0, match.index).split('\n').length,
        businessCalls: this.extractBusinessFunctionCalls(funcBody),
        hasOutput: funcBody.includes('// Output:'),
        complexity: this.calculateComplexity(funcBody)
      });
    }
  }

  parseInitFunctions(content, fileInfo) {
    // init函数
    const initRegex = /func\s+init\s*\(\s*\)\s*{/g;
    let match;

    while ((match = initRegex.exec(content)) !== null) {
      const funcBodyStart = match.index + match[0].length;
      const funcBody = this.extractFunctionBody(content, funcBodyStart);
      
      fileInfo.initFunctions.push({
        name: 'init',
        type: 'init',
        line: content.substring(0, match.index).split('\n').length,
        calls: this.extractFunctionCallsEnhanced(funcBody),
        complexity: this.calculateComplexity(funcBody),
        hasRegistration: this.detectRegistrationPattern(funcBody),
        hasGlobalState: this.detectGlobalStateAccess(funcBody)
      });
    }
  }

  parseGoroutines(content, fileInfo) {
    // 检测goroutine使用
    const goroutineRegex = /go\s+(\w+(?:\.\w+)*)\s*\(/g;
    let match;

    while ((match = goroutineRegex.exec(content)) !== null) {
      const functionCall = match[1];
      
      fileInfo.goroutines.push({
        call: functionCall,
        line: content.substring(0, match.index).split('\n').length,
        type: 'goroutine'
      });
    }

    // 检测匿名goroutine
    const anonGoroutineRegex = /go\s+func\s*\([^)]*\)\s*{/g;
    while ((match = anonGoroutineRegex.exec(content)) !== null) {
      fileInfo.goroutines.push({
        call: 'anonymous',
        line: content.substring(0, match.index).split('\n').length,
        type: 'anonymous_goroutine'
      });
    }
  }

  parseChannels(content, fileInfo) {
    // 检测channel声明
    const chanDeclRegex = /(\w+)\s+:?=\s*make\s*\(\s*chan\s+([^),]+)(?:,\s*(\d+))?\s*\)/g;
    let match;

    while ((match = chanDeclRegex.exec(content)) !== null) {
      const varName = match[1];
      const channelType = match[2].trim();
      const bufferSize = match[3] || '0';
      
      fileInfo.channels.push({
        name: varName,
        type: channelType,
        bufferSize: parseInt(bufferSize),
        line: content.substring(0, match.index).split('\n').length,
        isBuffered: bufferSize !== '0'
      });
    }

    // 检测channel操作
    const chanOpRegex = /(\w+)\s*(<-|<-\s*\w+)/g;
    while ((match = chanOpRegex.exec(content)) !== null) {
      const channelName = match[1];
      const operation = match[2].trim();
      
      fileInfo.channels.push({
        name: channelName,
        operation: operation.startsWith('<-') ? 'receive' : 'send',
        line: content.substring(0, match.index).split('\n').length,
        type: 'operation'
      });
    }

    // 检测select语句
    const selectRegex = /select\s*{([\s\S]*?)}/g;
    while ((match = selectRegex.exec(content)) !== null) {
      const selectBody = match[1];
      const cases = this.parseSelectCases(selectBody);
      
      fileInfo.channels.push({
        type: 'select',
        line: content.substring(0, match.index).split('\n').length,
        cases: cases
      });
    }
  }

  parseInterfacesEnhanced(content, fileInfo) {
    // 增强的接口解析，支持嵌入接口
    const interfaceRegex = /type\s+(\w+)\s+interface\s*{([\s\S]*?)}/g;
    let match;

    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      const interfaceBody = match[2];
      
      const methods = [];
      const embeddedInterfaces = [];
      
      // 解析方法签名和嵌入接口
      const lines = interfaceBody.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'));
        
      for (const line of lines) {
        // 检测嵌入接口
        const embeddedMatch = line.match(/^(\w+(?:\.\w+)*)$/);
        if (embeddedMatch) {
          embeddedInterfaces.push({
            name: embeddedMatch[1],
            line: this.getLineNumber(content, interfaceBody, line)
          });
          continue;
        }
        
        // 解析方法签名
        const methodMatch = line.match(/(\w+)\s*\(([^)]*)\)(?:\s*\(([^)]*)\))?/);
        if (methodMatch) {
          const methodName = methodMatch[1];
          const params = methodMatch[2];
          const returns = methodMatch[3];
          
          methods.push({
            name: methodName,
            signature: line,
            parameters: this.parseParameters(params),
            returns: this.parseReturnTypes(returns),
            line: this.getLineNumber(content, interfaceBody, line)
          });
        }
      }

      fileInfo.interfaces.push({
        name: interfaceName,
        kind: 'interface',
        methods: methods,
        embeddedInterfaces: embeddedInterfaces,
        line: content.substring(0, match.index).split('\n').length,
        isExported: interfaceName[0] === interfaceName[0].toUpperCase(),
        isEmpty: methods.length === 0 && embeddedInterfaces.length === 0
      });
    }
  }

  parseEmbeddedTypes(content, fileInfo) {
    // 解析结构体中的嵌入类型
    const structRegex = /type\s+(\w+)\s+struct\s*{([\s\S]*?)}/g;
    let match;

    while ((match = structRegex.exec(content)) !== null) {
      const structName = match[1];
      const structBody = match[2];
      
      const embeddedTypes = [];
      const lines = structBody.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'));
        
      for (const line of lines) {
        // 检测嵌入类型（没有字段名的类型）
        const embeddedMatch = line.match(/^(\*?)(\w+(?:\.\w+)*)(?:\s+`[^`]*`)?$/);
        if (embeddedMatch && !line.includes(' ')) {
          const isPointer = embeddedMatch[1] === '*';
          const typeName = embeddedMatch[2];
          
          embeddedTypes.push({
            structName: structName,
            embeddedType: typeName,
            isPointer: isPointer,
            line: this.getLineNumber(content, structBody, line)
          });
        }
      }
      
      if (embeddedTypes.length > 0) {
        fileInfo.embeddedTypes.push(...embeddedTypes);
      }
    }
  }

  // 辅助方法
  parseParameters(params) {
    if (!params || !params.trim()) return [];
    
    return params.split(',')
      .map(param => param.trim())
      .filter(param => param)
      .map(param => {
        const parts = param.trim().split(/\s+/);
        if (parts.length >= 2) {
          return {
            name: parts[0],
            type: parts.slice(1).join(' ')
          };
        }
        return {
          name: '',
          type: param.trim()
        };
      });
  }

  parseReturnTypes(returns) {
    if (!returns || !returns.trim()) return [];
    
    return returns.split(',')
      .map(ret => ret.trim())
      .filter(ret => ret)
      .map(ret => ({ type: ret }));
  }

  calculateComplexity(funcBody) {
    // 简单的复杂度计算
    let complexity = 1;
    
    const complexityIncreasers = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bselect\b/g,
      /\bgo\b/g,
      /\bdefer\b/g
    ];
    
    complexityIncreasers.forEach(regex => {
      const matches = funcBody.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  extractFunctionCallsEnhanced(functionBody) {
    const calls = [];
    
    // 增强的函数调用匹配，包括方法调用
    const callRegex = /(\w+(?:\.\w+)*)\s*\(/g;
    let match;
    
    while ((match = callRegex.exec(functionBody)) !== null) {
      const funcCall = match[1];
      // 过滤掉关键字和控制结构
      if (!['if', 'for', 'switch', 'select', 'range', 'go', 'defer', 'return', 'make', 'new', 'len', 'cap', 'append', 'copy', 'delete'].includes(funcCall)) {
        calls.push({
          name: funcCall,
          type: funcCall.includes('.') ? 'method' : 'function',
          line: this.getLineNumberInText(functionBody, match.index)
        });
      }
    }
    
    return [...new Map(calls.map(call => [call.name, call])).values()]; // 去重但保留详细信息
  }

  extractBusinessFunctionCalls(testBody) {
    const businessCalls = [];
    
    // 提取测试中调用的业务函数（排除testing相关调用）
    const callRegex = /(\w+(?:\.\w+)*)\s*\(/g;
    let match;
    
    while ((match = callRegex.exec(testBody)) !== null) {
      const funcCall = match[1];
      
      // 排除testing框架的方法和Go内置函数
      if (!funcCall.includes('testing') && 
          !funcCall.startsWith('t.') && 
          !funcCall.startsWith('b.') && 
          !['if', 'for', 'switch', 'select', 'range', 'go', 'defer', 'return', 'make', 'new', 'len', 'cap', 'append', 'copy', 'delete', 'fmt', 'log'].includes(funcCall.split('.')[0])) {
        businessCalls.push({
          name: funcCall,
          line: this.getLineNumberInText(testBody, match.index)
        });
      }
    }
    
    return [...new Map(businessCalls.map(call => [call.name, call])).values()];
  }

  detectChannelUsage(funcBody) {
    return {
      hasChannelOps: /<-/.test(funcBody),
      hasChannelCreation: /make\s*\(\s*chan/.test(funcBody),
      hasSelect: /\bselect\b/.test(funcBody),
      hasClose: /\bclose\s*\(/.test(funcBody)
    };
  }

  detectInterfaceUsage(funcBody, params, returns) {
    const interfaceKeywords = /\binterface\b/;
    return {
      hasInterfaceParam: params && interfaceKeywords.test(params),
      hasInterfaceReturn: returns && interfaceKeywords.test(returns),
      hasTypeAssertion: /\.\s*\(\s*\w+\s*\)/.test(funcBody),
      hasTypeSwitch: /\.\s*\(\s*type\s*\)/.test(funcBody)
    };
  }

  detectRegistrationPattern(funcBody) {
    return /register|Register|init|Init/.test(funcBody);
  }

  detectGlobalStateAccess(funcBody) {
    return /var\s+\w+|global|Global/.test(funcBody);
  }

  parseSelectCases(selectBody) {
    const cases = [];
    const caseRegex = /case\s+([^:]+):/g;
    let match;
    
    while ((match = caseRegex.exec(selectBody)) !== null) {
      const caseExpr = match[1].trim();
      cases.push({
        expression: caseExpr,
        type: caseExpr.includes('<-') ? 'channel' : 'default'
      });
    }
    
    return cases;
  }

  getLineNumber(content, section, line) {
    const sectionStart = content.indexOf(section);
    const lineStart = content.indexOf(line, sectionStart);
    return content.substring(0, lineStart).split('\n').length;
  }

  getLineNumberInText(text, index) {
    return text.substring(0, index).split('\n').length;
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

  generateEnhancedSummary(result) {
    const fileCount = result.files.length;
    const businessFiles = result.files.filter(f => f.fileType === 'business').length;
    const testFiles = result.files.filter(f => f.fileType === 'test').length;
    
    const functionCount = Object.values(result.functions).reduce((sum, funcs) => sum + funcs.length, 0);
    const typeCount = Object.values(result.types).reduce((sum, types) => sum + types.length, 0);
    
    const testFunctionCount = result.files.reduce((sum, file) => sum + (file.testFunctions?.length || 0), 0);
    const benchmarkCount = result.files.reduce((sum, file) => sum + (file.benchmarkFunctions?.length || 0), 0);
    const exampleCount = result.files.reduce((sum, file) => sum + (file.exampleFunctions?.length || 0), 0);
    
    const goroutineCount = result.files.reduce((sum, file) => sum + (file.goroutines?.length || 0), 0);
    const channelCount = result.files.reduce((sum, file) => sum + (file.channels?.length || 0), 0);
    const interfaceCount = result.files.reduce((sum, file) => sum + (file.interfaces?.length || 0), 0);

    return {
      totalFiles: fileCount,
      businessFiles: businessFiles,
      testFiles: testFiles,
      totalFunctions: functionCount,
      totalTypes: typeCount,
      testFunctions: testFunctionCount,
      benchmarkFunctions: benchmarkCount,
      exampleFunctions: exampleCount,
      goroutineUsage: goroutineCount,
      channelUsage: channelCount,
      interfaceDefinitions: interfaceCount,
      totalDependencies: result.modules.dependencies.length,
      moduleName: result.modules.moduleName,
      goVersion: result.modules.goVersion,
      testCoverage: result.testCoverage.overallCoverage || 0,
      testGaps: result.testCoverage.gaps?.length || 0,
      averageFunctionsPerFile: fileCount > 0 ? Math.round(functionCount / fileCount * 100) / 100 : 0,
      analysisDate: result.timestamp,
      analysisVersion: '2.0'
    };
  }
}

// 新增：测试覆盖分析器
class GoTestCoverageAnalyzer {
  analyze(analysisResult) {
    console.error('🧪 分析Go测试覆盖情况...');
    
    const coverage = {
      overallCoverage: 0,
      gaps: [],
      testFiles: [],
      businessFiles: [],
      uncoveredFunctions: [],
      statistics: {}
    };

    // 获取业务文件和测试文件
    const businessFiles = analysisResult.files.filter(f => f.fileType === 'business');
    const testFiles = analysisResult.files.filter(f => f.fileType === 'test');
    
    coverage.businessFiles = businessFiles.map(f => f.relativePath);
    coverage.testFiles = testFiles.map(f => f.relativePath);

    // 构建测试覆盖映射
    const testCoverageMap = this.buildTestCoverageMap(businessFiles, testFiles);
    
    // 分析每个业务函数的测试覆盖情况
    for (const businessFile of businessFiles) {
      for (const func of businessFile.functions || []) {
        const coverage_info = this.analyzeTestCoverageForFunction(
          businessFile, func, testFiles, testCoverageMap
        );
        
        if (!coverage_info.isCovered) {
          coverage.gaps.push({
            className: businessFile.packageName,
            methodName: func.name,
            signature: func.signature,
            filePath: businessFile.relativePath,
            line: func.line,
            riskLevel: this.calculateRiskLevel(func, businessFile),
            riskDisplayName: this.getRiskDisplayName(this.calculateRiskLevel(func, businessFile)),
            reason: this.generateRiskReason(func, coverage_info),
            impactedCallers: coverage_info.potentialCallers || [],
            impactedCallersCount: coverage_info.potentialCallers?.length || 0,
            complexity: func.complexity || 1,
            isExported: func.isExported
          });
        }
      }
    }

    // 计算总体覆盖率
    const totalBusinessFunctions = businessFiles.reduce((sum, file) => sum + (file.functions?.length || 0), 0);
    const coveredFunctions = totalBusinessFunctions - coverage.gaps.length;
    coverage.overallCoverage = totalBusinessFunctions > 0 ? Math.round((coveredFunctions / totalBusinessFunctions) * 100) : 100;

    // 生成统计信息
    coverage.statistics = {
      totalBusinessFunctions: totalBusinessFunctions,
      coveredFunctions: coveredFunctions,
      uncoveredFunctions: coverage.gaps.length,
      totalTestFunctions: testFiles.reduce((sum, file) => sum + (file.testFunctions?.length || 0), 0),
      highRiskGaps: coverage.gaps.filter(gap => gap.riskLevel === 'HIGH').length,
      mediumRiskGaps: coverage.gaps.filter(gap => gap.riskLevel === 'MEDIUM').length,
      lowRiskGaps: coverage.gaps.filter(gap => gap.riskLevel === 'LOW').length
    };

    console.error(`📊 测试覆盖率: ${coverage.overallCoverage}% (${coveredFunctions}/${totalBusinessFunctions})`);
    console.error(`🚨 发现 ${coverage.gaps.length} 个测试覆盖漏洞`);

    return coverage;
  }

  buildTestCoverageMap(businessFiles, testFiles) {
    const coverageMap = new Map();
    
    for (const testFile of testFiles) {
      for (const testFunc of testFile.testFunctions || []) {
        for (const businessCall of testFunc.businessCalls || []) {
          if (!coverageMap.has(businessCall.name)) {
            coverageMap.set(businessCall.name, []);
          }
          coverageMap.get(businessCall.name).push({
            testFile: testFile.relativePath,
            testFunction: testFunc.name,
            line: businessCall.line
          });
        }
      }
    }
    
    return coverageMap;
  }

  analyzeTestCoverageForFunction(businessFile, func, testFiles, testCoverageMap) {
    // 检查函数是否被测试覆盖
    const funcName = func.name;
    const qualifiedName = `${businessFile.packageName}.${funcName}`;
    
    const directCoverage = testCoverageMap.has(funcName) || testCoverageMap.has(qualifiedName);
    
    // 检查是否通过调用链被间接测试
    const indirectCoverage = this.checkIndirectCoverage(func, testFiles);
    
    // 分析潜在调用者
    const potentialCallers = this.findPotentialCallers(func, businessFile);
    
    return {
      isCovered: directCoverage || indirectCoverage,
      hasDirectTests: directCoverage,
      hasIndirectTests: indirectCoverage,
      potentialCallers: potentialCallers,
      testingMethods: testCoverageMap.get(funcName) || []
    };
  }

  checkIndirectCoverage(func, testFiles) {
    // 简化的间接覆盖检查
    // 实际实现可能需要更复杂的调用图分析
    return false;
  }

  findPotentialCallers(func, businessFile) {
    const callers = [];
    
    // 在同一文件中查找调用者
    for (const otherFunc of businessFile.functions || []) {
      if (otherFunc.name !== func.name) {
        for (const call of otherFunc.calls || []) {
          if (call.name === func.name || call.name.endsWith(`.${func.name}`)) {
            callers.push(`${businessFile.packageName}.${otherFunc.name}`);
          }
        }
      }
    }
    
    return callers;
  }

  calculateRiskLevel(func, file) {
    let riskScore = 0;
    
    // 基于函数复杂度
    riskScore += Math.min(func.complexity || 1, 10);
    
    // 基于是否导出
    if (func.isExported) {
      riskScore += 5;
    }
    
    // 基于特殊功能
    if (func.hasGoroutine) riskScore += 3;
    if (func.usesChannels?.hasChannelOps) riskScore += 3;
    if (func.hasPanic) riskScore += 5;
    if (func.hasDefer) riskScore += 1;
    
    // 基于包重要性
    if (file.packageName === 'main') riskScore += 3;
    if (file.relativePath.includes('/internal/')) riskScore += 2;
    
    if (riskScore >= 15) return 'HIGH';
    if (riskScore >= 8) return 'MEDIUM';
    return 'LOW';
  }

  getRiskDisplayName(riskLevel) {
    const riskNames = {
      'HIGH': '高风险',
      'MEDIUM': '中风险',
      'LOW': '低风险'
    };
    return riskNames[riskLevel] || '未知';
  }

  generateRiskReason(func, coverageInfo) {
    const reasons = [];
    
    if (func.isExported) {
      reasons.push('公开方法缺少测试');
    }
    
    if (func.complexity > 5) {
      reasons.push(`高复杂度方法(${func.complexity})`);
    }
    
    if (func.hasGoroutine) {
      reasons.push('使用goroutine');
    }
    
    if (func.usesChannels?.hasChannelOps) {
      reasons.push('使用channel操作');
    }
    
    if (func.hasPanic) {
      reasons.push('包含panic调用');
    }
    
    if (coverageInfo.potentialCallers?.length > 0) {
      reasons.push(`被${coverageInfo.potentialCallers.length}个方法调用`);
    }
    
    return reasons.length > 0 ? reasons.join(', ') : '无直接测试覆盖';
  }
}

// 新增：增强调用图分析器
class GoCallGraphAnalyzer {
  constructor(targetDir) {
    this.targetDir = targetDir;
    this.astParser = new GoASTParser();
    this.toolPath = {
      callvis: null,
      guru: null,
      golist: 'go'
    };
  }

  async buildEnhancedCallGraph(fileInfos, functions) {
    console.error('🕸️ 构建增强调用图 (使用Go工具链)...');
    
    // 1. 检查可用工具
    const availableTools = await this.checkAvailableTools();
    console.error(`📋 可用工具: ${Object.keys(availableTools).filter(k => availableTools[k]).join(', ')}`);
    
    // 2. 使用最佳可用工具构建调用图
    let callGraph;
    if (availableTools.callvis) {
      callGraph = await this.buildCallGraphWithCallvis(fileInfos, functions);
    } else if (availableTools.guru) {
      callGraph = await this.buildCallGraphWithGuru(fileInfos, functions);
    } else {
      console.error('⚠️  未找到go-callvis或guru，使用内置分析器');
      callGraph = await this.buildCallGraphFallback(fileInfos, functions);
    }
    
    // 3. 增强调用图信息
    await this.enhanceCallGraphWithAST(callGraph, fileInfos);
    
    // 4. 添加测试覆盖信息
    this.addTestCoverageToCallGraph(callGraph, fileInfos);
    
    console.error(`📊 增强调用图: ${callGraph.nodes.length} 节点, ${callGraph.edges.length} 边`);
    
    return callGraph;
  }

  async checkAvailableTools() {
    const tools = {
      callvis: false,
      guru: false,
      golist: false
    };

    try {
      // 检查 go-callvis
      await execFileAsync('go-callvis', ['-version']);
      tools.callvis = true;
      this.toolPath.callvis = 'go-callvis';
    } catch (error) {
      // 尝试通过go install安装
      try {
        console.error('🔄 尝试安装 go-callvis...');
        await execFileAsync('go', ['install', 'github.com/ofabry/go-callvis@latest']);
        const gopath = await this.getGoPath();
        this.toolPath.callvis = path.join(gopath, 'bin', 'go-callvis');
        tools.callvis = true;
        console.error('✅ go-callvis 安装成功');
      } catch (installError) {
        console.error('❌ go-callvis 不可用');
      }
    }

    try {
      // 检查 guru
      await execFileAsync('guru', ['-help']);
      tools.guru = true;
      this.toolPath.guru = 'guru';
    } catch (error) {
      try {
        console.error('🔄 尝试安装 guru...');
        await execFileAsync('go', ['install', 'golang.org/x/tools/cmd/guru@latest']);
        const gopath = await this.getGoPath();
        this.toolPath.guru = path.join(gopath, 'bin', 'guru');
        tools.guru = true;
        console.error('✅ guru 安装成功');
      } catch (installError) {
        console.error('❌ guru 不可用');
      }
    }

    try {
      // 检查 go list
      await execFileAsync('go', ['list', '-h']);
      tools.golist = true;
    } catch (error) {
      console.error('❌ go list 不可用');
    }

    return tools;
  }

  async getGoPath() {
    try {
      const result = await execFileAsync('go', ['env', 'GOPATH']);
      return result.stdout.trim();
    } catch (error) {
      return process.env.GOPATH || path.join(process.env.HOME || process.env.USERPROFILE, 'go');
    }
  }

  async buildCallGraphWithCallvis(fileInfos, functions) {
    console.error('🔍 使用 go-callvis 构建调用图...');
    
    try {
      // 获取主包路径
      const mainPackage = await this.findMainPackage();
      if (!mainPackage) {
        console.error('⚠️  未找到main包，使用模块根路径');
        return await this.buildCallGraphFallback(fileInfos, functions);
      }

      // 生成调用图数据
      const callvisArgs = [
        '-format=json',
        '-group=pkg',
        '-nostd',
        '-skipbrowser',
        mainPackage
      ];

      const result = await execFileAsync(this.toolPath.callvis, callvisArgs, {
        cwd: this.targetDir,
        timeout: 30000 // 30秒超时
      });

      // 解析 go-callvis 输出
      const callvisData = JSON.parse(result.stdout);
      return this.convertCallvisToCallGraph(callvisData, fileInfos);

    } catch (error) {
      console.error('go-callvis 执行失败:', error.message);
      console.error('🔄 回退到内置分析器');
      return await this.buildCallGraphFallback(fileInfos, functions);
    }
  }

  async buildCallGraphWithGuru(fileInfos, functions) {
    console.error('🔍 使用 guru 构建调用图...');
    
    try {
      // 构建scope参数
      const scope = await this.buildGuruScope();
      
      const nodes = [];
      const edges = [];
      const nodeMap = new Map();

      // 为每个函数运行guru callstack分析
      for (const fileInfo of fileInfos) {
        for (const func of fileInfo.functions || []) {
          try {
            const funcPosition = `${fileInfo.relativePath}:#${func.line}`;
            
            // 分析调用者 (callers)
            const callersResult = await execFileAsync(this.toolPath.guru, [
              '-scope', scope,
              'callers',
              funcPosition
            ], {
              cwd: this.targetDir,
              timeout: 10000
            });

            // 分析被调用者 (callees)  
            const calleesResult = await execFileAsync(this.toolPath.guru, [
              '-scope', scope,
              'callees',
              funcPosition
            ], {
              cwd: this.targetDir,
              timeout: 10000
            });

            // 解析guru输出并添加到调用图
            this.parseGuruOutput(callersResult.stdout, calleesResult.stdout, func, fileInfo, nodes, edges, nodeMap);

          } catch (funcError) {
            // 单个函数分析失败不影响整体
            console.error(`guru分析函数失败 ${func.name}:`, funcError.message);
          }
        }
      }

      return { nodes, edges };

    } catch (error) {
      console.error('guru 执行失败:', error.message);
      console.error('🔄 回退到内置分析器');
      return await this.buildCallGraphFallback(fileInfos, functions);
    }
  }

  async buildGuruScope() {
    try {
      // 使用 go list 获取所有包
      const result = await execFileAsync('go', ['list', './...'], {
        cwd: this.targetDir
      });
      
      const packages = result.stdout.trim().split('\n').filter(pkg => pkg);
      return packages.join(',');
    } catch (error) {
      // 回退到当前目录
      return './...';
    }
  }

  parseGuruOutput(callersOutput, calleesOutput, func, fileInfo, nodes, edges, nodeMap) {
    const funcId = `${fileInfo.packageName}.${func.name}`;
    
    // 添加当前函数节点
    if (!nodeMap.has(funcId)) {
      const node = {
        data: {
          id: funcId,
          label: func.name,
          signature: func.signature,
          file: fileInfo.relativePath,
          package: fileInfo.packageName,
          type: func.type || 'function',
          isExported: func.isExported,
          complexity: func.complexity || 1,
          source: 'guru'
        }
      };
      nodes.push(node);
      nodeMap.set(funcId, node);
    }

    // 解析调用者
    const callerLines = callersOutput.split('\n').filter(line => line.trim());
    for (const line of callerLines) {
      const callerMatch = line.match(/^(.+):(\d+):(\d+):\s*(.+)$/);
      if (callerMatch) {
        const [, filePath, lineNum, , context] = callerMatch;
        const callerId = this.extractFunctionFromContext(context, filePath);
        
        if (callerId && callerId !== funcId) {
          edges.push({
            data: {
              id: `${callerId}->${funcId}`,
              source: callerId,
              target: funcId,
              type: 'calls',
              line: parseInt(lineNum),
              source: 'guru'
            }
          });
        }
      }
    }

    // 解析被调用者
    const calleeLines = calleesOutput.split('\n').filter(line => line.trim());
    for (const line of calleeLines) {
      const calleeMatch = line.match(/^(.+):(\d+):(\d+):\s*(.+)$/);
      if (calleeMatch) {
        const [, filePath, lineNum, , context] = calleeMatch;
        const calleeId = this.extractFunctionFromContext(context, filePath);
        
        if (calleeId && calleeId !== funcId) {
          edges.push({
            data: {
              id: `${funcId}->${calleeId}`,
              source: funcId,
              target: calleeId,
              type: 'calls',
              line: parseInt(lineNum),
              source: 'guru'
            }
          });
        }
      }
    }
  }

  extractFunctionFromContext(context, filePath) {
    // 从guru输出的context中提取函数名
    const funcMatch = context.match(/(\w+(?:\.\w+)*)/);
    if (funcMatch) {
      return funcMatch[1];
    }
    return null;
  }

  convertCallvisToCallGraph(callvisData, fileInfos) {
    const nodes = [];
    const edges = [];
    
    // 转换callvis数据格式到标准调用图格式
    if (callvisData.nodes) {
      for (const node of callvisData.nodes) {
        nodes.push({
          data: {
            id: node.id,
            label: node.label || node.id,
            package: node.group || '',
            type: 'function',
            source: 'callvis'
          }
        });
      }
    }
    
    if (callvisData.edges) {
      for (const edge of callvisData.edges) {
        edges.push({
          data: {
            id: `${edge.source}->${edge.target}`,
            source: edge.source,
            target: edge.target,
            type: 'calls',
            source: 'callvis'
          }
        });
      }
    }
    
    return { nodes, edges };
  }

  async findMainPackage() {
    try {
      // 查找包含main函数的包
      const result = await execFileAsync('go', ['list', '-find', '-f', '{{.ImportPath}}', './...'], {
        cwd: this.targetDir
      });
      
      const packages = result.stdout.trim().split('\n');
      
      // 检查每个包是否包含main函数
      for (const pkg of packages) {
        try {
          const pkgInfo = await execFileAsync('go', ['list', '-f', '{{.Name}}', pkg], {
            cwd: this.targetDir
          });
          
          if (pkgInfo.stdout.trim() === 'main') {
            return pkg;
          }
        } catch (error) {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  async buildCallGraphFallback(fileInfos, functions) {
    console.error('🔄 使用内置调用图分析器...');
    
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();
    
    // 使用原有的简化分析逻辑
    for (const fileInfo of fileInfos) {
      for (const func of fileInfo.functions || []) {
        const nodeId = `${fileInfo.packageName}.${func.name}`;
        const node = {
          data: {
            id: nodeId,
            label: func.name,
            signature: func.signature,
            file: fileInfo.relativePath,
            package: fileInfo.packageName,
            type: func.type || 'function',
            receiver: func.receiver || null,
            isExported: func.isExported,
            complexity: func.complexity || 1,
            hasTests: fileInfo.fileType === 'test' || this.hasDirectTests(func, fileInfos),
            riskLevel: this.calculateNodeRisk(func),
            fileType: fileInfo.fileType,
            source: 'builtin'
          }
        };
        
        nodes.push(node);
        nodeMap.set(nodeId, node);
      }
    }
    
    // 构建边（调用关系）
    for (const fileInfo of fileInfos) {
      for (const func of fileInfo.functions || []) {
        const sourceId = `${fileInfo.packageName}.${func.name}`;
        
        for (const call of func.calls || []) {
          const targetId = this.resolveCallTarget(call, fileInfo, fileInfos);
          if (targetId && nodeMap.has(targetId)) {
            edges.push({
              data: {
                id: `${sourceId}->${targetId}`,
                source: sourceId,
                target: targetId,
                type: call.type || 'calls',
                callLine: call.line,
                source: 'builtin'
              }
            });
          }
        }
      }
    }
    
    return { nodes, edges };
  }

  async enhanceCallGraphWithAST(callGraph, fileInfos) {
    console.error('🌳 使用AST增强调用图信息...');
    
    try {
      // 为每个节点添加AST分析信息
      for (const node of callGraph.nodes) {
        const fileInfo = fileInfos.find(f => 
          f.relativePath === node.data.file || 
          f.packageName === node.data.package
        );
        
        if (fileInfo) {
          const astInfo = await this.astParser.analyzeFunctionAST(
            fileInfo.path, 
            node.data.label
          );
          
          // 合并AST信息到节点
          Object.assign(node.data, {
            astComplexity: astInfo.complexity,
            dependencies: astInfo.dependencies,
            sideEffects: astInfo.sideEffects,
            parameterTypes: astInfo.parameterTypes,
            returnTypes: astInfo.returnTypes,
            usedPackages: astInfo.usedPackages
          });
        }
      }

      // 添加diff映射信息
      await this.addDiffMappingInfo(callGraph, fileInfos);

    } catch (error) {
      console.error('AST增强失败:', error.message);
    }
  }

  async addDiffMappingInfo(callGraph, fileInfos) {
    console.error('🔄 添加diff映射信息...');
    
    // 为调用图添加变更影响分析
    for (const edge of callGraph.edges) {
      const sourceNode = callGraph.nodes.find(n => n.data.id === edge.data.source);
      const targetNode = callGraph.nodes.find(n => n.data.id === edge.data.target);
      
      if (sourceNode && targetNode) {
        // 分析调用关系的影响范围
        edge.data.impactAnalysis = {
          crossPackage: sourceNode.data.package !== targetNode.data.package,
          crossFile: sourceNode.data.file !== targetNode.data.file,
          riskLevel: this.calculateCallRisk(sourceNode, targetNode),
          changeImpact: this.calculateChangeImpact(sourceNode, targetNode)
        };
      }
    }
  }

  calculateCallRisk(sourceNode, targetNode) {
    let risk = 0;
    
    // 跨包调用风险更高
    if (sourceNode.data.package !== targetNode.data.package) risk += 2;
    
    // 复杂度高的函数风险更高
    if (targetNode.data.complexity > 10) risk += 3;
    if (sourceNode.data.complexity > 10) risk += 2;
    
    // 未测试的函数风险更高
    if (!targetNode.data.hasTests) risk += 3;
    if (!sourceNode.data.hasTests) risk += 1;
    
    // 导出函数的变更影响更大
    if (targetNode.data.isExported) risk += 2;
    
    if (risk >= 8) return 'HIGH';
    if (risk >= 5) return 'MEDIUM';
    return 'LOW';
  }

  calculateChangeImpact(sourceNode, targetNode) {
    return {
      directImpact: 1, // 直接影响
      testImpact: sourceNode.data.hasTests ? 0.5 : 1.5, // 测试覆盖影响
      complexityImpact: (targetNode.data.complexity || 1) / 10, // 复杂度影响
      exportImpact: targetNode.data.isExported ? 1.5 : 1 // 导出影响
    };
  }

  addTestCoverageToCallGraph(callGraph, fileInfos) {
    console.error('🧪 添加测试覆盖信息到调用图...');
    
    // 为每个节点添加测试覆盖状态
    for (const node of callGraph.nodes) {
      const hasTests = this.hasDirectTests(node.data.label, fileInfos);
      const testCoverage = this.calculateTestCoverage(node.data.label, fileInfos);
      
      Object.assign(node.data, {
        hasTests: hasTests,
        testCoverage: testCoverage,
        testGap: !hasTests && node.data.isExported
      });
    }
    
    // 计算调用链的测试覆盖
    for (const edge of callGraph.edges) {
      const sourceNode = callGraph.nodes.find(n => n.data.id === edge.data.source);
      const targetNode = callGraph.nodes.find(n => n.data.id === edge.data.target);
      
      if (sourceNode && targetNode) {
        edge.data.testCoverageGap = !sourceNode.data.hasTests && !targetNode.data.hasTests;
      }
    }
  }

  hasDirectTests(funcName, fileInfos) {
    for (const fileInfo of fileInfos) {
      if (fileInfo.fileType === 'test') {
        for (const testFunc of fileInfo.testFunctions || []) {
          for (const businessCall of testFunc.businessCalls || []) {
            if (businessCall.name === funcName || businessCall.name.endsWith(`.${funcName}`)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  calculateTestCoverage(funcName, fileInfos) {
    let coverageCount = 0;
    let totalTests = 0;
    
    for (const fileInfo of fileInfos) {
      if (fileInfo.fileType === 'test') {
        totalTests += fileInfo.testFunctions?.length || 0;
        
        for (const testFunc of fileInfo.testFunctions || []) {
          for (const businessCall of testFunc.businessCalls || []) {
            if (businessCall.name === funcName || businessCall.name.endsWith(`.${funcName}`)) {
              coverageCount++;
              break;
            }
          }
        }
      }
    }
    
    return totalTests > 0 ? Math.round((coverageCount / totalTests) * 100) : 0;
  }

  resolveCallTarget(call, sourceFile, allFiles) {
    const callName = call.name;
    
    // 尝试在同一包中查找
    const samePackageTarget = `${sourceFile.packageName}.${callName}`;
    
    // 尝试解析带包名的调用
    if (callName.includes('.')) {
      const parts = callName.split('.');
      if (parts.length === 2) {
        const packageOrReceiver = parts[0];
        const funcName = parts[1];
        
        // 查找对应的包或接收者
        for (const fileInfo of allFiles) {
          if (fileInfo.packageName === packageOrReceiver) {
            return `${packageOrReceiver}.${funcName}`;
          }
          
          // 检查是否是方法调用
          for (const func of fileInfo.functions || []) {
            if (func.receiver === packageOrReceiver && func.name === funcName) {
              return `${fileInfo.packageName}.${func.name}`;
            }
          }
        }
      }
    }
    
    return samePackageTarget;
  }

  calculateNodeRisk(func) {
    if (func.complexity > 10) return 'high';
    if (func.complexity > 5) return 'medium';
    return 'low';
  }
}

// 新增：Go AST解析器
class GoASTParser {
  constructor() {
    this.astCache = new Map();
  }

  async analyzeFunctionAST(filePath, functionName) {
    try {
      // 使用go ast工具分析函数
      const result = await execFileAsync('go', ['tool', 'ast', filePath], {
        timeout: 10000
      });
      
      const astData = this.parseASTOutput(result.stdout, functionName);
      
      // 缓存结果
      const cacheKey = `${filePath}:${functionName}`;
      this.astCache.set(cacheKey, astData);
      
      return astData;

    } catch (error) {
      console.error(`AST分析失败 ${functionName}:`, error.message);
      return this.getFallbackASTInfo();
    }
  }

  parseASTOutput(astOutput, functionName) {
    // 解析go tool ast的输出，提取函数的AST信息
    const astInfo = {
      complexity: 1,
      dependencies: [],
      sideEffects: [],
      parameterTypes: [],
      returnTypes: [],
      usedPackages: []
    };

    try {
      // 简化的AST解析 - 实际实现会更复杂
      const lines = astOutput.split('\n');
      let inTargetFunction = false;
      let braceLevel = 0;

      for (const line of lines) {
        if (line.includes(`func ${functionName}`)) {
          inTargetFunction = true;
          continue;
        }

        if (inTargetFunction) {
          if (line.includes('{')) braceLevel++;
          if (line.includes('}')) braceLevel--;

          if (braceLevel === 0 && inTargetFunction) {
            break; // 函数结束
          }

          // 分析复杂度
          if (/\b(if|for|switch|select|case)\b/.test(line)) {
            astInfo.complexity++;
          }

          // 分析依赖
          const callMatch = line.match(/(\w+(?:\.\w+)*)\s*\(/);
          if (callMatch) {
            astInfo.dependencies.push(callMatch[1]);
          }

          // 分析副作用
          if (/\b(print|panic|go\s+|defer\s+)\b/.test(line)) {
            astInfo.sideEffects.push(line.trim());
          }

          // 分析包使用
          const pkgMatch = line.match(/(\w+)\./);
          if (pkgMatch) {
            astInfo.usedPackages.push(pkgMatch[1]);
          }
        }
      }

      // 去重
      astInfo.dependencies = [...new Set(astInfo.dependencies)];
      astInfo.usedPackages = [...new Set(astInfo.usedPackages)];

    } catch (error) {
      console.error('AST解析错误:', error.message);
    }

    return astInfo;
  }

  getFallbackASTInfo() {
    return {
      complexity: 1,
      dependencies: [],
      sideEffects: [],
      parameterTypes: [],
      returnTypes: [],
      usedPackages: []
    };
  }
}

// 新增：Go特性分析器
class GoFeaturesAnalyzer {
  analyze(analysisResult) {
    console.error('🎯 分析Go语言特性使用...');
    
    const features = {
      goroutineUsage: {
        totalFiles: 0,
        totalUsage: 0,
        patterns: []
      },
      channelUsage: {
        totalChannels: 0,
        bufferedChannels: 0,
        selectStatements: 0,
        patterns: []
      },
      interfaceUsage: {
        totalInterfaces: 0,
        emptyInterfaces: 0,
        embeddedInterfaces: 0,
        patterns: []
      },
      embedUsage: {
        totalEmbedded: 0,
        structEmbedding: 0,
        interfaceEmbedding: 0,
        patterns: []
      },
      initFunctions: {
        totalFiles: 0,
        totalInitFunctions: 0,
        patterns: []
      },
      genericsUsage: {
        totalFiles: 0,
        functionsWithGenerics: 0,
        typesWithGenerics: 0
      }
    };

    // 分析goroutine使用
    for (const file of analysisResult.files) {
      if (file.goroutines && file.goroutines.length > 0) {
        features.goroutineUsage.totalFiles++;
        features.goroutineUsage.totalUsage += file.goroutines.length;
        
        file.goroutines.forEach(gr => {
          features.goroutineUsage.patterns.push({
            file: file.relativePath,
            call: gr.call,
            line: gr.line,
            type: gr.type
          });
        });
      }
      
      // 分析channel使用
      if (file.channels && file.channels.length > 0) {
        const channelDecls = file.channels.filter(ch => ch.bufferSize !== undefined);
        features.channelUsage.totalChannels += channelDecls.length;
        features.channelUsage.bufferedChannels += channelDecls.filter(ch => ch.isBuffered).length;
        features.channelUsage.selectStatements += file.channels.filter(ch => ch.type === 'select').length;
        
        file.channels.forEach(ch => {
          features.channelUsage.patterns.push({
            file: file.relativePath,
            name: ch.name,
            type: ch.type,
            operation: ch.operation,
            line: ch.line
          });
        });
      }
      
      // 分析接口使用
      if (file.interfaces && file.interfaces.length > 0) {
        features.interfaceUsage.totalInterfaces += file.interfaces.length;
        features.interfaceUsage.emptyInterfaces += file.interfaces.filter(iface => iface.isEmpty).length;
        features.interfaceUsage.embeddedInterfaces += file.interfaces.reduce((sum, iface) => sum + (iface.embeddedInterfaces?.length || 0), 0);
        
        file.interfaces.forEach(iface => {
          features.interfaceUsage.patterns.push({
            file: file.relativePath,
            name: iface.name,
            methodCount: iface.methods?.length || 0,
            embeddedCount: iface.embeddedInterfaces?.length || 0,
            line: iface.line
          });
        });
      }
      
      // 分析嵌入使用
      if (file.embeddedTypes && file.embeddedTypes.length > 0) {
        features.embedUsage.totalEmbedded += file.embeddedTypes.length;
        features.embedUsage.structEmbedding += file.embeddedTypes.length; // 当前只分析结构体嵌入
        
        file.embeddedTypes.forEach(embed => {
          features.embedUsage.patterns.push({
            file: file.relativePath,
            struct: embed.structName,
            embedded: embed.embeddedType,
            isPointer: embed.isPointer,
            line: embed.line
          });
        });
      }
      
      // 分析init函数
      if (file.initFunctions && file.initFunctions.length > 0) {
        features.initFunctions.totalFiles++;
        features.initFunctions.totalInitFunctions += file.initFunctions.length;
        
        file.initFunctions.forEach(initFunc => {
          features.initFunctions.patterns.push({
            file: file.relativePath,
            hasRegistration: initFunc.hasRegistration,
            hasGlobalState: initFunc.hasGlobalState,
            complexity: initFunc.complexity,
            line: initFunc.line
          });
        });
      }
      
      // 分析泛型使用
      const functionsWithGenerics = (file.functions || []).filter(func => func.hasGenerics).length;
      if (functionsWithGenerics > 0) {
        features.genericsUsage.totalFiles++;
        features.genericsUsage.functionsWithGenerics += functionsWithGenerics;
      }
    }

    console.error(`🎯 Go特性分析完成:`);
    console.error(`  - Goroutine使用: ${features.goroutineUsage.totalUsage} 次 (${features.goroutineUsage.totalFiles} 文件)`);
    console.error(`  - Channel使用: ${features.channelUsage.totalChannels} 个 (缓冲: ${features.channelUsage.bufferedChannels})`);
    console.error(`  - 接口定义: ${features.interfaceUsage.totalInterfaces} 个 (空接口: ${features.interfaceUsage.emptyInterfaces})`);
    console.error(`  - 类型嵌入: ${features.embedUsage.totalEmbedded} 个`);
    console.error(`  - Init函数: ${features.initFunctions.totalInitFunctions} 个 (${features.initFunctions.totalFiles} 文件)`);

    return features;
  }
}

// 命令行调用
async function main() {
  const targetDir = process.argv[2] || process.cwd();
  const outputFormat = process.argv[3] || 'json';

  try {
    const analyzer = new GolangAnalyzer(targetDir, {
      includeTests: true,
      analyzeTestCoverage: true,
      analyzeGoroutines: true,
      analyzeChannels: true,
      analyzeInterfaces: true
    });
    
    const result = await analyzer.analyze();

    if (outputFormat === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('📊 Go代码增强分析完成!');
      console.log(`文件数: ${result.summary.totalFiles} (业务: ${result.summary.businessFiles}, 测试: ${result.summary.testFiles})`);
      console.log(`函数数: ${result.summary.totalFunctions}`);
      console.log(`类型数: ${result.summary.totalTypes}`);
      console.log(`测试覆盖率: ${result.summary.testCoverage}%`);
      console.log(`测试漏洞: ${result.summary.testGaps} 个`);
      console.log(`模块名: ${result.summary.moduleName || '未知'}`);
      console.log(`Go版本: ${result.summary.goVersion || '未知'}`);
    }

  } catch (error) {
    console.error('增强分析失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = GolangAnalyzer; 
/**
 * DiffSense 错误处理模块测试
 */

const { 
  ErrorCodes, 
  ErrorSeverity, 
  DiffSenseError, 
  ErrorHandler 
} = require('../errorHandler');

describe('DiffSense Error Handling System', () => {
  let errorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler({
      enableConsoleLog: false,
      enableFileLog: false
    });
  });

  describe('ErrorCodes', () => {
    test('应该包含所有预定义的错误码', () => {
      expect(ErrorCodes.FILE_NOT_FOUND).toBe(1001);
      expect(ErrorCodes.PARSE_ERROR).toBe(2001);
      expect(ErrorCodes.ANALYSIS_FAILED).toBe(3001);
      expect(ErrorCodes.CONFIG_ERROR).toBe(4001);
      expect(ErrorCodes.UNKNOWN_ERROR).toBe(9001);
    });
  });

  describe('ErrorSeverity', () => {
    test('应该包含所有严重程度级别', () => {
      expect(ErrorSeverity.LOW).toBe('low');
      expect(ErrorSeverity.MEDIUM).toBe('medium');
      expect(ErrorSeverity.HIGH).toBe('high');
      expect(ErrorSeverity.CRITICAL).toBe('critical');
    });
  });

  describe('DiffSenseError', () => {
    test('应该正确创建错误实例', () => {
      const error = new DiffSenseError(
        ErrorCodes.FILE_NOT_FOUND,
        '文件未找到',
        { filePath: '/test/file.js' },
        ErrorSeverity.HIGH
      );

      expect(error.name).toBe('DiffSenseError');
      expect(error.code).toBe(ErrorCodes.FILE_NOT_FOUND);
      expect(error.message).toBe('文件未找到');
      expect(error.details.filePath).toBe('/test/file.js');
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.timestamp).toBeDefined();
    });

    test('应该正确序列化为JSON', () => {
      const error = new DiffSenseError(
        ErrorCodes.PARSE_ERROR,
        '解析错误',
        { line: 10 }
      );

      const json = error.toJSON();
      expect(json.name).toBe('DiffSenseError');
      expect(json.code).toBe(ErrorCodes.PARSE_ERROR);
      expect(json.message).toBe('解析错误');
      expect(json.details.line).toBe(10);
    });

    test('应该返回正确的错误描述', () => {
      const error = new DiffSenseError(
        ErrorCodes.ANALYSIS_FAILED,
        '分析失败'
      );

      expect(error.getDescription()).toBe('[3001] 分析失败');
    });
  });

  describe('ErrorHandler', () => {
    test('应该正确创建错误处理器', () => {
      expect(errorHandler.logFile).toBe('diffsense-errors.log');
      expect(errorHandler.enableConsoleLog).toBe(false);
      expect(errorHandler.enableFileLog).toBe(false);
      expect(errorHandler.maxLogSize).toBe(10 * 1024 * 1024);
    });

    test('应该正确设置上下文', () => {
      errorHandler.setContext({ project: 'test-project' });
      expect(errorHandler.context.project).toBe('test-project');
    });

    test('应该正确创建错误实例', () => {
      const error = errorHandler.createError(
        ErrorCodes.FILE_NOT_FOUND,
        '文件未找到',
        { filePath: '/test.js' },
        ErrorSeverity.HIGH
      );

      expect(error).toBeInstanceOf(DiffSenseError);
      expect(error.code).toBe(ErrorCodes.FILE_NOT_FOUND);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    test('应该正确处理DiffSenseError', () => {
      const originalError = new DiffSenseError(
        ErrorCodes.PARSE_ERROR,
        '解析错误'
      );

      const handledError = errorHandler.handleError(originalError, {
        operation: 'test'
      });

      expect(handledError).toBe(originalError);
      expect(handledError.details.context.operation).toBe('test');
    });

    test('应该将普通Error转换为DiffSenseError', () => {
      const originalError = new Error('普通错误');
      const handledError = errorHandler.handleError(originalError);

      expect(handledError).toBeInstanceOf(DiffSenseError);
      expect(handledError.code).toBe(ErrorCodes.UNKNOWN_ERROR);
      expect(handledError.details.originalError).toBe('普通错误');
    });

    test('应该抛出CRITICAL级别的错误', () => {
      const criticalError = new DiffSenseError(
        ErrorCodes.MEMORY_ERROR,
        '内存不足',
        {},
        ErrorSeverity.CRITICAL
      );

      expect(() => {
        errorHandler.handleError(criticalError);
      }).toThrow(DiffSenseError);
    });

    test('应该正确执行安全函数', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const errorFn = jest.fn().mockRejectedValue(new Error('test error'));

      const successResult = await errorHandler.safeExecute(successFn);
      expect(successResult).toBe('success');

      const errorResult = await errorHandler.safeExecute(errorFn);
      expect(errorResult).toBeInstanceOf(DiffSenseError);
    });

    test('应该正确验证输入参数', () => {
      // 测试必需参数
      expect(() => {
        errorHandler.validateInput(undefined, 'string', 'testParam', true);
      }).toThrow();

      // 测试字符串类型
      expect(() => {
        errorHandler.validateInput(123, 'string', 'testParam');
      }).toThrow();

      // 测试数字类型
      expect(() => {
        errorHandler.validateInput('not a number', 'number', 'testParam');
      }).toThrow();

      // 测试布尔类型
      expect(() => {
        errorHandler.validateInput('not a boolean', 'boolean', 'testParam');
      }).toThrow();

      // 测试数组类型
      expect(() => {
        errorHandler.validateInput('not an array', 'array', 'testParam');
      }).toThrow();

      // 测试对象类型
      expect(() => {
        errorHandler.validateInput([], 'object', 'testParam');
      }).toThrow();

      // 测试有效输入
      expect(() => {
        errorHandler.validateInput('valid string', 'string', 'testParam');
        errorHandler.validateInput(123, 'number', 'testParam');
        errorHandler.validateInput(true, 'boolean', 'testParam');
        errorHandler.validateInput([], 'array', 'testParam');
        errorHandler.validateInput({}, 'object', 'testParam');
      }).not.toThrow();
    });

    test('应该正确统计错误', () => {
      const error1 = new DiffSenseError(ErrorCodes.FILE_NOT_FOUND, '错误1');
      const error2 = new DiffSenseError(ErrorCodes.PARSE_ERROR, '错误2');
      const error3 = new DiffSenseError(ErrorCodes.FILE_NOT_FOUND, '错误3');

      errorHandler.handleError(error1);
      errorHandler.handleError(error2);
      errorHandler.handleError(error3);

      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.byCode[ErrorCodes.FILE_NOT_FOUND]).toBe(2);
      expect(stats.byCode[ErrorCodes.PARSE_ERROR]).toBe(1);
    });

    test('应该正确清理错误统计', () => {
      const error = new DiffSenseError(ErrorCodes.FILE_NOT_FOUND, '错误');
      errorHandler.handleError(error);

      expect(errorHandler.getErrorStats().totalErrors).toBe(1);

      errorHandler.clearErrorStats();
      expect(errorHandler.getErrorStats().totalErrors).toBe(0);
    });
  });
}); 
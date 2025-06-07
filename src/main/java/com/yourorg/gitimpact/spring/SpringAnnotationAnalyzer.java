package com.yourorg.gitimpact.spring;

import com.yourorg.gitimpact.config.AnalysisConfig;
import com.yourorg.gitimpact.impact.MethodRef;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import spoon.reflect.CtModel;
import spoon.reflect.code.CtAnnotation;
import spoon.reflect.declaration.*;
import spoon.reflect.visitor.filter.TypeFilter;

import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Spring注解分析器
 * 专门分析Spring框架相关注解，包括：
 * - @RequestMapping, @GetMapping, @PostMapping等路由注解
 * - @Transactional事务注解
 * - @Service, @Controller, @Repository, @Component等Bean注解
 * - @Autowired, @Qualifier等依赖注入注解
 */
public class SpringAnnotationAnalyzer {
    private static final Logger logger = LoggerFactory.getLogger(SpringAnnotationAnalyzer.class);
    
    // Spring Web注解
    private static final Set<String> WEB_ANNOTATIONS = Set.of(
        "RequestMapping", "GetMapping", "PostMapping", "PutMapping", 
        "DeleteMapping", "PatchMapping", "RestController", "Controller"
    );
    
    // Spring事务注解
    private static final Set<String> TRANSACTION_ANNOTATIONS = Set.of(
        "Transactional"
    );
    
    // Spring Bean注解
    private static final Set<String> BEAN_ANNOTATIONS = Set.of(
        "Component", "Service", "Repository", "Controller", "RestController",
        "Configuration", "Bean"
    );
    
    // Spring依赖注入注解
    private static final Set<String> INJECTION_ANNOTATIONS = Set.of(
        "Autowired", "Qualifier", "Value", "Resource"
    );
    
    private final CtModel model;
    private final AnalysisConfig config;
    
    public SpringAnnotationAnalyzer(CtModel model, AnalysisConfig config) {
        this.model = model;
        this.config = config;
    }
    
    /**
     * 分析Spring注解
     */
    public SpringAnalysisResult analyze() {
        logger.info("开始Spring注解分析...");
        
        SpringAnalysisResult result = new SpringAnalysisResult();
        
        // 获取所有类型
        List<CtType<?>> types = model.getElements(new TypeFilter<>(CtType.class));
        
        for (CtType<?> type : types) {
            analyzeType(type, result);
        }
        
        // 分析Bean依赖关系
        analyzeBeanDependencies(result);
        
        logger.info("Spring注解分析完成，发现{}个Spring组件", result.getSpringBeans().size());
        return result;
    }
    
    /**
     * 分析单个类型
     */
    private void analyzeType(CtType<?> type, SpringAnalysisResult result) {
        String className = type.getQualifiedName();
        
        // 分析类级别注解
        SpringComponent component = analyzeClassAnnotations(type);
        if (component != null) {
            result.addSpringBean(component);
        }
        
        // 分析方法级别注解
        List<CtMethod<?>> methods = type.getElements(new TypeFilter<>(CtMethod.class));
        for (CtMethod<?> method : methods) {
            analyzeMethodAnnotations(method, className, result);
        }
        
        // 分析字段级别注解（依赖注入）
        List<CtField<?>> fields = type.getElements(new TypeFilter<>(CtField.class));
        for (CtField<?> field : fields) {
            analyzeFieldAnnotations(field, className, result);
        }
    }
    
    /**
     * 分析类级别注解
     */
    private SpringComponent analyzeClassAnnotations(CtType<?> type) {
        List<CtAnnotation<? extends java.lang.annotation.Annotation>> annotations = type.getAnnotations();
        
        SpringComponent component = new SpringComponent();
        component.setClassName(type.getQualifiedName());
        component.setSimpleName(type.getSimpleName());
        
        boolean isSpringComponent = false;
        
        for (CtAnnotation<?> annotation : annotations) {
            String annotationName = annotation.getAnnotationType().getSimpleName();
            
            if (BEAN_ANNOTATIONS.contains(annotationName)) {
                isSpringComponent = true;
                component.setComponentType(annotationName);
                
                // 提取注解属性
                if (annotation.getValues().containsKey("value")) {
                    component.setBeanName(annotation.getValues().get("value").toString());
                }
            }
            
            // 分析@RequestMapping类级别路由
            if ("RequestMapping".equals(annotationName)) {
                String[] paths = extractStringArrayValue(annotation, "value", "path");
                if (paths.length > 0) {
                    component.setBasePath(paths[0]);
                }
                
                String[] produces = extractStringArrayValue(annotation, "produces");
                String[] consumes = extractStringArrayValue(annotation, "consumes");
                component.setProduces(Arrays.asList(produces));
                component.setConsumes(Arrays.asList(consumes));
            }
        }
        
        return isSpringComponent ? component : null;
    }
    
    /**
     * 分析方法级别注解
     */
    private void analyzeMethodAnnotations(CtMethod<?> method, String className, SpringAnalysisResult result) {
        List<CtAnnotation<? extends java.lang.annotation.Annotation>> annotations = method.getAnnotations();
        MethodRef methodRef = new MethodRef(className, method.getSimpleName());
        
        for (CtAnnotation<?> annotation : annotations) {
            String annotationName = annotation.getAnnotationType().getSimpleName();
            
            // 分析Web注解
            if (WEB_ANNOTATIONS.contains(annotationName)) {
                RestApiEndpoint endpoint = analyzeWebAnnotation(annotation, method, className);
                if (endpoint != null) {
                    result.addRestEndpoint(endpoint);
                }
            }
            
            // 分析事务注解
            if (TRANSACTION_ANNOTATIONS.contains(annotationName)) {
                TransactionalMethod transactionalMethod = analyzeTransactionalAnnotation(annotation, method, className);
                result.addTransactionalMethod(transactionalMethod);
            }
        }
    }
    
    /**
     * 分析字段级别注解（依赖注入）
     */
    private void analyzeFieldAnnotations(CtField<?> field, String className, SpringAnalysisResult result) {
        List<CtAnnotation<? extends java.lang.annotation.Annotation>> annotations = field.getAnnotations();
        
        for (CtAnnotation<?> annotation : annotations) {
            String annotationName = annotation.getAnnotationType().getSimpleName();
            
            if (INJECTION_ANNOTATIONS.contains(annotationName)) {
                DependencyInjection injection = new DependencyInjection();
                injection.setOwnerClass(className);
                injection.setFieldName(field.getSimpleName());
                injection.setFieldType(field.getType().getQualifiedName());
                injection.setInjectionType(annotationName);
                
                // 提取@Qualifier值
                if ("Qualifier".equals(annotationName) && annotation.getValues().containsKey("value")) {
                    injection.setQualifier(annotation.getValues().get("value").toString());
                }
                
                // 提取@Value值
                if ("Value".equals(annotationName) && annotation.getValues().containsKey("value")) {
                    injection.setConfigValue(annotation.getValues().get("value").toString());
                }
                
                result.addDependencyInjection(injection);
            }
        }
    }
    
    /**
     * 分析Web注解，提取REST API信息
     */
    private RestApiEndpoint analyzeWebAnnotation(CtAnnotation<?> annotation, CtMethod<?> method, String className) {
        String annotationName = annotation.getAnnotationType().getSimpleName();
        
        RestApiEndpoint endpoint = new RestApiEndpoint();
        endpoint.setClassName(className);
        endpoint.setMethodName(method.getSimpleName());
        endpoint.setAnnotationType(annotationName);
        
        // 提取HTTP方法
        String httpMethod = mapAnnotationToHttpMethod(annotationName);
        endpoint.setHttpMethod(httpMethod);
        
        // 提取路径
        String[] paths = extractStringArrayValue(annotation, "value", "path");
        if (paths.length > 0) {
            endpoint.setPath(paths[0]);
        }
        
        // 提取produces和consumes
        String[] produces = extractStringArrayValue(annotation, "produces");
        String[] consumes = extractStringArrayValue(annotation, "consumes");
        endpoint.setProduces(Arrays.asList(produces));
        endpoint.setConsumes(Arrays.asList(consumes));
        
        // 分析方法参数（请求参数、路径变量等）
        List<CtParameter<?>> parameters = method.getParameters();
        for (CtParameter<?> param : parameters) {
            analyzeMethodParameter(param, endpoint);
        }
        
        return endpoint;
    }
    
    /**
     * 分析事务注解
     */
    private TransactionalMethod analyzeTransactionalAnnotation(CtAnnotation<?> annotation, CtMethod<?> method, String className) {
        TransactionalMethod transactionalMethod = new TransactionalMethod();
        transactionalMethod.setClassName(className);
        transactionalMethod.setMethodName(method.getSimpleName());
        
        // 提取事务属性
        if (annotation.getValues().containsKey("propagation")) {
            transactionalMethod.setPropagation(annotation.getValues().get("propagation").toString());
        }
        
        if (annotation.getValues().containsKey("isolation")) {
            transactionalMethod.setIsolation(annotation.getValues().get("isolation").toString());
        }
        
        if (annotation.getValues().containsKey("readOnly")) {
            transactionalMethod.setReadOnly(Boolean.parseBoolean(annotation.getValues().get("readOnly").toString()));
        }
        
        if (annotation.getValues().containsKey("timeout")) {
            transactionalMethod.setTimeout(Integer.parseInt(annotation.getValues().get("timeout").toString()));
        }
        
        if (annotation.getValues().containsKey("rollbackFor")) {
            // 处理rollbackFor异常类
            Object rollbackFor = annotation.getValues().get("rollbackFor");
            if (rollbackFor != null) {
                transactionalMethod.setRollbackFor(rollbackFor.toString());
            }
        }
        
        return transactionalMethod;
    }
    
    /**
     * 分析方法参数注解
     */
    private void analyzeMethodParameter(CtParameter<?> param, RestApiEndpoint endpoint) {
        List<CtAnnotation<? extends java.lang.annotation.Annotation>> annotations = param.getAnnotations();
        
        for (CtAnnotation<?> annotation : annotations) {
            String annotationName = annotation.getAnnotationType().getSimpleName();
            
            ApiParameter apiParam = new ApiParameter();
            apiParam.setName(param.getSimpleName());
            apiParam.setType(param.getType().getQualifiedName());
            apiParam.setAnnotationType(annotationName);
            
            // 提取参数属性
            if (annotation.getValues().containsKey("value")) {
                apiParam.setValue(annotation.getValues().get("value").toString());
            }
            
            if (annotation.getValues().containsKey("required")) {
                apiParam.setRequired(Boolean.parseBoolean(annotation.getValues().get("required").toString()));
            }
            
            if (annotation.getValues().containsKey("defaultValue")) {
                apiParam.setDefaultValue(annotation.getValues().get("defaultValue").toString());
            }
            
            endpoint.addParameter(apiParam);
        }
    }
    
    /**
     * 分析Bean依赖关系
     */
    private void analyzeBeanDependencies(SpringAnalysisResult result) {
        Map<String, SpringComponent> beanMap = result.getSpringBeans().stream()
            .collect(Collectors.toMap(SpringComponent::getClassName, bean -> bean));
        
        for (DependencyInjection injection : result.getDependencyInjections()) {
            String ownerClass = injection.getOwnerClass();
            String fieldType = injection.getFieldType();
            
            // 查找对应的Bean
            SpringComponent ownerBean = beanMap.get(ownerClass);
            SpringComponent dependencyBean = findBeanByType(result.getSpringBeans(), fieldType);
            
            if (ownerBean != null && dependencyBean != null) {
                ownerBean.addDependency(dependencyBean.getClassName());
                result.addBeanDependency(new BeanDependency(ownerBean.getClassName(), dependencyBean.getClassName(), injection.getFieldName()));
            }
        }
    }
    
    /**
     * 根据类型查找Bean
     */
    private SpringComponent findBeanByType(List<SpringComponent> beans, String type) {
        return beans.stream()
            .filter(bean -> bean.getClassName().equals(type) || implementsInterface(bean.getClassName(), type))
            .findFirst()
            .orElse(null);
    }
    
    /**
     * 检查类是否实现了指定接口（简化版）
     */
    private boolean implementsInterface(String className, String interfaceName) {
        // 这里可以扩展为更复杂的类型检查
        return className.equals(interfaceName);
    }
    
    /**
     * 从注解中提取字符串数组值
     */
    private String[] extractStringArrayValue(CtAnnotation<?> annotation, String... keys) {
        for (String key : keys) {
            if (annotation.getValues().containsKey(key)) {
                Object value = annotation.getValues().get(key);
                if (value instanceof String) {
                    return new String[]{(String) value};
                } else if (value instanceof List) {
                    @SuppressWarnings("unchecked")
                    List<String> list = (List<String>) value;
                    return list.toArray(new String[0]);
                }
            }
        }
        return new String[0];
    }
    
    /**
     * 映射注解名称到HTTP方法
     */
    private String mapAnnotationToHttpMethod(String annotationName) {
        switch (annotationName) {
            case "GetMapping": return "GET";
            case "PostMapping": return "POST";
            case "PutMapping": return "PUT";
            case "DeleteMapping": return "DELETE";
            case "PatchMapping": return "PATCH";
            case "RequestMapping": return "GET"; // 默认为GET，实际需要从annotation中提取
            default: return "UNKNOWN";
        }
    }
} 
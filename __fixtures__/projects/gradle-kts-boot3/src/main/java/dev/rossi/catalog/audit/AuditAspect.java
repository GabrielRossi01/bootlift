package dev.rossi.catalog.audit;

import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class AuditAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);

    @Before("execution(* dev.rossi.catalog.product.ProductService.*(..))")
    public void audit(JoinPoint joinPoint) {
        log.info("audit: {}", joinPoint.getSignature().toShortString());
    }
}

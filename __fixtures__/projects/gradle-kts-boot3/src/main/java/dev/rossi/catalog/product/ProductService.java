package dev.rossi.catalog.product;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

@Service
public class ProductService {

    private final ProductRepository repository;
    private final ObjectMapper objectMapper;

    public ProductService(ProductRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public JsonNode attributesOf(String productId) throws Exception {
        Product product = repository.findById(productId).orElseThrow();
        return objectMapper.readTree(product.attributesJson());
    }
}

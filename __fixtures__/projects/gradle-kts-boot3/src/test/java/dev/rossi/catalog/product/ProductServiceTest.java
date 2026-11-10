package dev.rossi.catalog.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;

@SpringBootTest
class ProductServiceTest {

    @Autowired
    private ProductService service;

    @SpyBean
    private ProductRepository repository;

    @Test
    void readsAttributes() throws Exception {
        given(repository.findById("p1"))
                .willReturn(Optional.of(new Product("p1", "Caneca", "{\"cor\":\"verde\"}")));

        assertThat(service.attributesOf("p1").get("cor").asText()).isEqualTo("verde");
    }
}
